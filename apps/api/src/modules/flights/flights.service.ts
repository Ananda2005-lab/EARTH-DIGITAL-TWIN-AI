import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { bboxContains, type BBox, type FlightFeed, type FlightPhase, type FlightState } from '@edt/shared';
import type { AppConfig } from 'src/config/configuration';
import { UPSTREAM_URLS } from 'src/infra/upstream/providers';
import { UpstreamService } from 'src/infra/upstream/upstream.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';

export interface FlightQuery {
  bbox?: BBox;
  limit: number;
  onGround?: boolean;
  minAltitude?: number;
  callsign?: string;
}

/** OpenSky `/states/all` returns positional arrays, not objects. */
type OpenSkyState = [
  icao24: string,
  callsign: string | null,
  originCountry: string,
  timePosition: number | null,
  lastContact: number,
  longitude: number | null,
  latitude: number | null,
  baroAltitude: number | null,
  onGround: boolean,
  velocity: number | null,
  trueTrack: number | null,
  verticalRate: number | null,
  sensors: number[] | null,
  geoAltitude: number | null,
  squawk: string | null,
  spi: boolean,
  positionSource: number,
];

interface OpenSkyResponse {
  time: number;
  states: OpenSkyState[] | null;
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

/**
 * Live ADS-B traffic from the OpenSky Network.
 *
 * Anonymous access is heavily rate limited, so when client credentials are
 * configured we exchange them for an OAuth2 token and cache it until shortly
 * before expiry.
 */
@Injectable()
export class FlightsService {
  private readonly logger = new Logger(FlightsService.name);
  private token: TokenCache | null = null;

  constructor(
    private readonly upstream: UpstreamService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async feed(query: FlightQuery): Promise<FlightFeed> {
    const headers = await this.authHeaders();
    const result = await this.upstream.safeJson<OpenSkyResponse>(
      {
        provider: 'openSky',
        url: UPSTREAM_URLS.openSkyStates,
        headers,
        ttl: 20,
        retries: 1,
        cacheKey: query.bbox ? query.bbox.join(',') : 'global',
        query: query.bbox
          ? {
              lamin: query.bbox[1],
              lomin: query.bbox[0],
              lamax: query.bbox[3],
              lomax: query.bbox[2],
            }
          : undefined,
      },
      { time: Math.floor(Date.now() / 1000), states: null },
    );

    const callsign = query.callsign?.trim().toUpperCase();
    const flights = (result.data.states ?? [])
      .map((state) => mapState(state))
      .filter((flight): flight is FlightState => flight !== null)
      .filter((flight) => {
        if (query.bbox && !bboxContains(query.bbox, flight.position)) return false;
        if (query.onGround !== undefined && flight.onGround !== query.onGround) return false;
        if (query.minAltitude !== undefined && (flight.altitude ?? 0) < query.minAltitude) return false;
        if (callsign && !(flight.callsign ?? '').toUpperCase().startsWith(callsign)) return false;
        return true;
      })
      .sort((a, b) => (b.altitude ?? 0) - (a.altitude ?? 0));

    return {
      flights: flights.slice(0, query.limit),
      total: flights.length,
      bbox: query.bbox,
      attribution: result.attribution,
      fetchedAt: new Date(result.data.time * 1000).toISOString(),
    };
  }

  async byIcao24(icao24: string): Promise<FlightState | null> {
    const feed = await this.feed({ limit: 4000 });
    return feed.flights.find((flight) => flight.icao24.toLowerCase() === icao24.toLowerCase()) ?? null;
  }

  /** Airports from the gazetteer, optionally filtered by country or bbox. */
  async airports(options: { countryCode?: string; bbox?: BBox; limit: number }): Promise<
    { icao: string; iata: string | null; name: string; city: string | null; countryCode: string; lng: number; lat: number; passengers: number | null }[]
  > {
    const rows = await this.prisma.airport.findMany({
      where: {
        countryCode: options.countryCode?.toUpperCase(),
        ...(options.bbox
          ? {
              lng: { gte: Math.min(options.bbox[0], options.bbox[2]), lte: Math.max(options.bbox[0], options.bbox[2]) },
              lat: { gte: Math.min(options.bbox[1], options.bbox[3]), lte: Math.max(options.bbox[1], options.bbox[3]) },
            }
          : {}),
      },
      orderBy: [{ passengers: 'desc' }, { name: 'asc' }],
      take: options.limit,
    });

    return rows.map((row) => ({
      icao: row.icao,
      iata: row.iata,
      name: row.name,
      city: row.city,
      countryCode: row.countryCode,
      lng: row.lng,
      lat: row.lat,
      passengers: row.passengers === null ? null : Number(row.passengers),
    }));
  }

  private async authHeaders(): Promise<Record<string, string> | undefined> {
    const keys = this.config.get('upstream', { infer: true }).keys;
    if (!keys.openSkyClientId || !keys.openSkyClientSecret) return undefined;

    if (this.token && this.token.expiresAt > Date.now() + 30_000) {
      return { authorization: `Bearer ${this.token.accessToken}` };
    }

    try {
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: keys.openSkyClientId,
        client_secret: keys.openSkyClientSecret,
      });
      const response = await fetch(UPSTREAM_URLS.openSkyToken, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      if (!response.ok) throw new Error(`token endpoint responded ${response.status}`);
      const payload = (await response.json()) as { access_token?: string; expires_in?: number };
      if (!payload.access_token) throw new Error('token response had no access_token');
      this.token = {
        accessToken: payload.access_token,
        expiresAt: Date.now() + (payload.expires_in ?? 1800) * 1000,
      };
      return { authorization: `Bearer ${this.token.accessToken}` };
    } catch (error) {
      this.logger.warn(`OpenSky token exchange failed, falling back to anonymous access: ${(error as Error).message}`);
      return undefined;
    }
  }
}

function mapState(state: OpenSkyState): FlightState | null {
  const [icao24, callsign, originCountry, , lastContact, longitude, latitude, baroAltitude, onGround, velocity, trueTrack, verticalRate, , geoAltitude, squawk, spi] =
    state;
  if (longitude === null || latitude === null) return null;

  return {
    icao24,
    callsign: callsign?.trim() ? callsign.trim() : null,
    originCountry,
    position: { lng: longitude, lat: latitude },
    altitude: baroAltitude,
    geoAltitude,
    velocity: velocity === null ? null : Number((velocity * 3.6).toFixed(1)),
    heading: trueTrack,
    verticalRate,
    onGround,
    phase: flightPhase(onGround, verticalRate),
    squawk: squawk ?? null,
    spi,
    lastContact: new Date(lastContact * 1000).toISOString(),
  };
}

function flightPhase(onGround: boolean, verticalRate: number | null): FlightPhase {
  if (onGround) return 'ground';
  if (verticalRate === null) return 'unknown';
  if (verticalRate > 1.5) return 'climb';
  if (verticalRate < -1.5) return 'descent';
  return 'cruise';
}
