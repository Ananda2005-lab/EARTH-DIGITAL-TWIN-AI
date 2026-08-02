import { Injectable } from '@nestjs/common';
import type { Continent as PrismaContinent } from '@prisma/client';
import type { IndicatorSeries } from '@edt/shared';
import { AppException } from 'src/common/errors/app-exception';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { CountriesService } from '../countries/countries.service';
import { INDICATORS, findIndicator, type IndicatorDefinition } from './indicators';

export interface RankingEntry {
  code: string;
  name: string;
  flagEmoji: string;
  continent: string;
  value: number;
  year: number;
  rank: number;
}

export interface CorrelationResult {
  x: IndicatorDefinition;
  y: IndicatorDefinition;
  /** Pearson product-moment correlation coefficient. */
  coefficient: number;
  sampleSize: number;
  points: { code: string; name: string; x: number; y: number }[];
}

export interface PlatformOverview {
  countries: number;
  cities: number;
  airports: number;
  seaports: number;
  indicatorObservations: number;
  totalPopulation: number;
  totalLandAreaKm2: number;
  continents: { continent: string; countries: number; population: number }[];
}

/** Cross-country analytics: series, rankings, correlations and global roll-ups. */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly countries: CountriesService,
  ) {}

  catalogue(): readonly IndicatorDefinition[] {
    return INDICATORS;
  }

  /** One series per requested country, refreshed from upstream when missing. */
  async series(options: {
    indicator: string;
    countries?: string[];
    from?: number;
    to?: number;
    limit: number;
  }): Promise<(IndicatorSeries & { countryCode: string })[]> {
    const definition = findIndicator(options.indicator);
    if (!definition) throw AppException.badRequest('Unknown indicator code');

    const codes = (options.countries ?? ['US', 'CN', 'DE', 'IN', 'BR'])
      .map((code) => code.trim().toUpperCase())
      .filter((code) => /^[A-Z]{2}$/u.test(code))
      .slice(0, 12);

    const results: (IndicatorSeries & { countryCode: string })[] = [];
    for (const code of codes) {
      const series = await this.countries.indicatorSeries(code, definition.code, options.limit);
      results.push({
        ...series,
        countryCode: code,
        points: series.points.filter(
          (point) => (!options.from || point.year >= options.from) && (!options.to || point.year <= options.to),
        ),
      });
    }
    return results;
  }

  /** Ranking by the most recent stored observation per country. */
  async ranking(options: {
    indicator: string;
    direction: 'asc' | 'desc';
    limit: number;
    continent?: string;
  }): Promise<RankingEntry[]> {
    const definition = findIndicator(options.indicator);
    if (!definition) throw AppException.badRequest('Unknown indicator code');

    const rows = await this.prisma.countryIndicator.findMany({
      where: {
        indicator: definition.code,
        country: options.continent ? { continent: options.continent as PrismaContinent } : undefined,
      },
      orderBy: { year: 'desc' },
      select: {
        value: true,
        year: true,
        country: { select: { code: true, name: true, flagEmoji: true, continent: true } },
      },
    });

    const latest = new Map<string, { value: number; year: number; name: string; flagEmoji: string; continent: string }>();
    for (const row of rows) {
      if (latest.has(row.country.code)) continue;
      latest.set(row.country.code, {
        value: row.value,
        year: row.year,
        name: row.country.name,
        flagEmoji: row.country.flagEmoji,
        continent: row.country.continent,
      });
    }

    return [...latest.entries()]
      .sort(([, a], [, b]) => (options.direction === 'asc' ? a.value - b.value : b.value - a.value))
      .slice(0, options.limit)
      .map(([code, entry], index) => ({
        code,
        name: entry.name,
        flagEmoji: entry.flagEmoji,
        continent: entry.continent,
        value: entry.value,
        year: entry.year,
        rank: index + 1,
      }));
  }

  async correlation(options: { x: string; y: string; continent?: string }): Promise<CorrelationResult> {
    const xDefinition = findIndicator(options.x);
    const yDefinition = findIndicator(options.y);
    if (!xDefinition || !yDefinition) throw AppException.badRequest('Unknown indicator code');

    const [xRanking, yRanking] = await Promise.all([
      this.ranking({ indicator: xDefinition.code, direction: 'desc', limit: 250, continent: options.continent }),
      this.ranking({ indicator: yDefinition.code, direction: 'desc', limit: 250, continent: options.continent }),
    ]);

    const yByCode = new Map(yRanking.map((entry) => [entry.code, entry]));
    const points = xRanking
      .map((entry) => {
        const counterpart = yByCode.get(entry.code);
        return counterpart
          ? { code: entry.code, name: entry.name, x: entry.value, y: counterpart.value }
          : null;
      })
      .filter((point): point is { code: string; name: string; x: number; y: number } => point !== null);

    return {
      x: xDefinition,
      y: yDefinition,
      coefficient: pearson(points.map((point) => point.x), points.map((point) => point.y)),
      sampleSize: points.length,
      points,
    };
  }

  async overview(): Promise<PlatformOverview> {
    const [countries, cities, airports, seaports, observations, aggregate, byContinent] = await Promise.all([
      this.prisma.country.count(),
      this.prisma.city.count(),
      this.prisma.airport.count(),
      this.prisma.seaport.count(),
      this.prisma.countryIndicator.count(),
      this.prisma.country.aggregate({ _sum: { population: true, areaKm2: true } }),
      this.prisma.country.groupBy({
        by: ['continent'],
        _count: { _all: true },
        _sum: { population: true },
        orderBy: { continent: 'asc' },
      }),
    ]);

    return {
      countries,
      cities,
      airports,
      seaports,
      indicatorObservations: observations,
      totalPopulation: Number(aggregate._sum.population ?? 0),
      totalLandAreaKm2: Math.round(aggregate._sum.areaKm2 ?? 0),
      continents: byContinent.map((entry) => ({
        continent: entry.continent,
        countries: entry._count._all,
        population: Number(entry._sum.population ?? 0),
      })),
    };
  }
}

/** Pearson correlation; returns 0 for degenerate input rather than NaN. */
export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const meanX = xs.slice(0, n).reduce((total, value) => total + value, 0) / n;
  const meanY = ys.slice(0, n).reduce((total, value) => total + value, 0) / n;
  let numerator = 0;
  let sumSquaredX = 0;
  let sumSquaredY = 0;
  for (let index = 0; index < n; index += 1) {
    const dx = (xs[index] ?? 0) - meanX;
    const dy = (ys[index] ?? 0) - meanY;
    numerator += dx * dy;
    sumSquaredX += dx * dx;
    sumSquaredY += dy * dy;
  }
  const denominator = Math.sqrt(sumSquaredX * sumSquaredY);
  return denominator === 0 ? 0 : Number((numerator / denominator).toFixed(4));
}
