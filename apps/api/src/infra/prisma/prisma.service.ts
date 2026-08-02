import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '@prisma/client';
import type { AppConfig } from 'src/config/configuration';

/**
 * Prisma Client wired into the Nest lifecycle.
 *
 * Every query in the codebase goes through Prisma's typed builder or
 * `$queryRaw` with tagged-template parameters — no string concatenation, ever.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService<AppConfig, true>) {
    const database = config.get('database', { infer: true });
    super({
      datasources: { db: { url: database.url } },
      log: database.logQueries
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ]
        : [{ emit: 'stdout', level: 'error' }],
      errorFormat: 'minimal',
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connection established');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Lightweight liveness probe for the health module. */
  async ping(): Promise<number> {
    const started = Date.now();
    await this.$queryRaw`SELECT 1`;
    return Date.now() - started;
  }

  /** True when PostGIS is installed, so spatial code paths can degrade safely. */
  async hasPostgis(): Promise<boolean> {
    try {
      const rows = await this.$queryRaw<{ installed: boolean }[]>`
        SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') AS installed
      `;
      return rows[0]?.installed === true;
    } catch {
      return false;
    }
  }

  /**
   * Ids of hazard-alert subscriptions whose geofence contains a point.
   * Uses the GIST-indexed geography column when PostGIS is available and falls
   * back to a bounding-box + haversine filter otherwise.
   */
  async findAlertIdsWithinRadius(lng: number, lat: number): Promise<string[]> {
    if (await this.hasPostgis()) {
      const rows = await this.$queryRaw<{ id: string }[]>`
        SELECT id FROM alerts
        WHERE active = true
          AND (mute_until IS NULL OR mute_until < NOW())
          AND geom IS NOT NULL
          AND ST_DWithin(geom, ST_SetSRID(ST_MakePoint(${lng}::double precision, ${lat}::double precision), 4326)::geography, radius_km * 1000)
      `;
      return rows.map((row) => row.id);
    }

    const rows = await this.$queryRaw<{ id: string }[]>`
      SELECT id FROM alerts
      WHERE active = true
        AND (mute_until IS NULL OR mute_until < NOW())
        AND 6371 * acos(
              least(1, greatest(-1,
                sin(radians(lat)) * sin(radians(${lat}::double precision)) +
                cos(radians(lat)) * cos(radians(${lat}::double precision)) *
                cos(radians(lng) - radians(${lng}::double precision))
              ))
            ) <= radius_km
    `;
    return rows.map((row) => row.id);
  }

  /** Trigram-ranked place search across the countries and cities gazetteer. */
  async searchGazetteer(
    query: string,
    limit: number,
  ): Promise<{ kind: 'country' | 'city'; id: string; name: string; countryCode: string; lng: number; lat: number; population: number; score: number }[]> {
    return this.$queryRaw<
      {
        kind: 'country' | 'city';
        id: string;
        name: string;
        countryCode: string;
        lng: number;
        lat: number;
        population: number;
        score: number;
      }[]
    >`
      SELECT 'country'::text AS kind, id, name, code AS "countryCode", lng, lat,
             population::double precision AS population,
             similarity(name, ${query}) AS score
      FROM countries
      WHERE name % ${query} OR official_name % ${query} OR code = upper(${query})
      UNION ALL
      SELECT 'city'::text AS kind, id, name, country_code AS "countryCode", lng, lat,
             population::double precision AS population,
             similarity(name, ${query}) AS score
      FROM cities
      WHERE name % ${query} OR ascii_name % ${query}
      ORDER BY score DESC, population DESC
      LIMIT ${limit}
    `;
  }

  /** Cities ordered by great-circle distance from a point. */
  async nearestCities(
    lng: number,
    lat: number,
    limit: number,
  ): Promise<{ id: string; name: string; countryCode: string; distanceKm: number }[]> {
    return this.$queryRaw<{ id: string; name: string; countryCode: string; distanceKm: number }[]>`
      SELECT id, name, country_code AS "countryCode",
             6371 * acos(
               least(1, greatest(-1,
                 sin(radians(lat)) * sin(radians(${lat}::double precision)) +
                 cos(radians(lat)) * cos(radians(${lat}::double precision)) *
                 cos(radians(lng) - radians(${lng}::double precision))
               ))
             ) AS "distanceKm"
      FROM cities
      ORDER BY "distanceKm" ASC
      LIMIT ${limit}
    `;
  }

  /** Purge expired auth artefacts; called by the scheduled maintenance job. */
  async pruneExpiredTokens(now = new Date()): Promise<{ refreshTokens: number; resets: number; verifications: number }> {
    const [refreshTokens, resets, verifications] = await this.$transaction([
      this.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } }),
      this.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } }),
      this.emailVerificationToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    ]);
    return {
      refreshTokens: refreshTokens.count,
      resets: resets.count,
      verifications: verifications.count,
    };
  }

  static isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
