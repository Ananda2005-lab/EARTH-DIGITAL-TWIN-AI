import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { AppConfig } from 'src/config/configuration';
import { AppException } from 'src/common/errors/app-exception';
import { RedisService } from 'src/infra/redis/redis.service';
import { CircuitBreaker, type CircuitSnapshot } from './circuit-breaker';
import { providerTtl, PROVIDER_KEYS, type ProviderKey } from './providers';

export type QueryValue = string | number | boolean | undefined | null;

export interface UpstreamRequest {
  provider: ProviderKey;
  url: string;
  query?: Record<string, QueryValue>;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Override the provider's default cache TTL, in seconds. `0` disables caching. */
  ttl?: number;
  retries?: number;
  timeoutMs?: number;
  /** Extra discriminator when the URL alone does not identify the payload. */
  cacheKey?: string;
}

export interface UpstreamResult<T> {
  data: T;
  cached: boolean;
  ageSeconds: number;
  attribution: string;
}

/** Absolute URL with only defined query parameters appended. */
export function buildUrl(base: string, query: Record<string, QueryValue> = {}): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/** Minimal RFC 4180-ish CSV parser (NASA FIRMS returns CSV, not JSON). */
export function parseCsv(input: string): Record<string, string>[] {
  const lines = input.trim().split(/\r?\n/u);
  const header = lines.shift();
  if (!header) return [];
  const columns = header.split(',').map((column) => column.trim());
  return lines
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const cells = line.split(',');
      return columns.reduce<Record<string, string>>((row, column, index) => {
        row[column] = (cells[index] ?? '').trim();
        return row;
      }, {});
    });
}

/**
 * Every outbound HTTP call in the API goes through here.
 *
 * Guarantees, in order: circuit breaker (skip known-dead providers), Redis cache
 * (per-provider TTL), timeout, retry with full-jitter exponential backoff, and
 * a stale-cache fallback so a provider outage degrades the payload rather than
 * failing the request.
 */
@Injectable()
export class UpstreamService {
  private readonly logger = new Logger(UpstreamService.name);
  private readonly breakers = new Map<ProviderKey, CircuitBreaker>();

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly redis: RedisService,
  ) {
    const upstream = this.config.get('upstream', { infer: true });
    for (const provider of PROVIDER_KEYS) {
      this.breakers.set(
        provider,
        new CircuitBreaker(provider, {
          failureThreshold: upstream.circuitFailureThreshold,
          resetMs: upstream.circuitResetMs,
        }),
      );
    }
  }

  /** JSON request with caching, retries and breaker protection. */
  async json<T>(request: UpstreamRequest): Promise<UpstreamResult<T>> {
    return this.execute<T>(request, async (response) => (await response.json()) as T);
  }

  /** Plain-text request (CSV/TLE endpoints). */
  async text(request: UpstreamRequest): Promise<UpstreamResult<string>> {
    return this.execute<string>(request, (response) => response.text());
  }

  /**
   * Never-throwing variant. Returns `fallback` when the provider is down, which
   * is what lets fused feeds (hazards, space weather) stay online with partial
   * data instead of returning 503.
   */
  async safeJson<T>(request: UpstreamRequest, fallback: T): Promise<UpstreamResult<T>> {
    try {
      return await this.json<T>(request);
    } catch (error) {
      this.logger.warn(
        `Provider ${request.provider} degraded: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return {
        data: fallback,
        cached: false,
        ageSeconds: 0,
        attribution: this.attribution(request.provider),
      };
    }
  }

  async safeText(request: UpstreamRequest, fallback = ''): Promise<UpstreamResult<string>> {
    try {
      return await this.text(request);
    } catch (error) {
      this.logger.warn(
        `Provider ${request.provider} degraded: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return {
        data: fallback,
        cached: false,
        ageSeconds: 0,
        attribution: this.attribution(request.provider),
      };
    }
  }

  /** Cache-through wrapper for values that are computed from several calls. */
  async cached<T>(
    provider: ProviderKey,
    key: string,
    ttlSeconds: number,
    factory: () => Promise<T>,
  ): Promise<UpstreamResult<T>> {
    const cacheKey = this.cacheKeyFor(provider, key);
    const hit = await this.redis.get<T>(cacheKey);
    if (hit) {
      return {
        data: hit.value,
        cached: true,
        ageSeconds: hit.ageSeconds,
        attribution: this.attribution(provider),
      };
    }
    const data = await factory();
    if (ttlSeconds > 0) await this.redis.set(cacheKey, data, ttlSeconds);
    return { data, cached: false, ageSeconds: 0, attribution: this.attribution(provider) };
  }

  circuitSnapshots(): CircuitSnapshot[] {
    return [...this.breakers.values()].map((breaker) => breaker.snapshot());
  }

  resetCircuit(provider?: ProviderKey): void {
    if (provider) {
      this.breakers.get(provider)?.reset();
      return;
    }
    for (const breaker of this.breakers.values()) breaker.reset();
  }

  async invalidate(provider: ProviderKey): Promise<number> {
    return this.redis.deleteByPattern(`upstream:${provider}:*`);
  }

  attribution(provider: ProviderKey): string {
    return UPSTREAM_ATTRIBUTION[provider];
  }

  private cacheKeyFor(provider: ProviderKey, discriminator: string): string {
    return `upstream:${provider}:${createHash('sha1').update(discriminator).digest('hex')}`;
  }

  private async execute<T>(
    request: UpstreamRequest,
    parse: (response: Response) => Promise<T>,
  ): Promise<UpstreamResult<T>> {
    const upstream = this.config.get('upstream', { infer: true });
    const url = buildUrl(request.url, request.query);
    const ttl = request.ttl ?? providerTtl(request.provider);
    const cacheKey = this.cacheKeyFor(
      request.provider,
      `${request.method ?? 'GET'} ${url} ${request.cacheKey ?? ''}`,
    );
    const attribution = this.attribution(request.provider);

    if (ttl > 0) {
      const hit = await this.redis.get<T>(cacheKey);
      if (hit) return { data: hit.value, cached: true, ageSeconds: hit.ageSeconds, attribution };
    }

    const breaker = this.breakers.get(request.provider);
    if (breaker && !breaker.canRequest()) {
      const stale = await this.redis.get<T>(`${cacheKey}:stale`);
      if (stale) {
        return { data: stale.value, cached: true, ageSeconds: stale.ageSeconds, attribution };
      }
      throw AppException.upstreamUnavailable(`${request.provider} is temporarily unavailable`, {
        provider: request.provider,
        retryAfterMs: breaker.retryAfterMs(),
      });
    }

    const retries = request.retries ?? upstream.retries;
    const timeoutMs = request.timeoutMs ?? upstream.timeoutMs;
    let lastError: Error = new Error(`${request.provider} request failed`);

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const data = await this.attempt(request, url, timeoutMs, parse);
        breaker?.recordSuccess();
        if (ttl > 0) {
          await this.redis.set(cacheKey, data, ttl);
          // Long-lived shadow copy used only when the breaker is open.
          await this.redis.set(`${cacheKey}:stale`, data, Math.max(ttl * 10, 3600));
        }
        return { data, cached: false, ageSeconds: 0, attribution };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < retries) await delay(jitteredBackoff(upstream.backoffMs, attempt));
      }
    }

    breaker?.recordFailure(lastError.message);

    const stale = await this.redis.get<T>(`${cacheKey}:stale`);
    if (stale) {
      this.logger.warn(`Serving stale ${request.provider} payload (${stale.ageSeconds}s old)`);
      return { data: stale.value, cached: true, ageSeconds: stale.ageSeconds, attribution };
    }

    throw AppException.upstreamUnavailable(`${request.provider} request failed`, {
      provider: request.provider,
      reason: lastError.message,
    });
  }

  private async attempt<T>(
    request: UpstreamRequest,
    url: string,
    timeoutMs: number,
    parse: (response: Response) => Promise<T>,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: request.method ?? 'GET',
        headers: {
          accept: 'application/json,text/plain,*/*',
          'user-agent': 'EarthDigitalTwin/1.0 (+https://earthdigitaltwin.ai)',
          ...(request.body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...request.headers,
        },
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        signal: controller.signal,
        redirect: 'follow',
      });
      if (!response.ok) {
        throw new Error(`${request.provider} responded ${response.status} ${response.statusText}`);
      }
      return await parse(response);
    } finally {
      clearTimeout(timer);
    }
  }
}

const UPSTREAM_ATTRIBUTION: Record<ProviderKey, string> = {
  openMeteoForecast: 'Open-Meteo · ECMWF IFS · NOAA GFS',
  openMeteoAirQuality: 'Copernicus CAMS via Open-Meteo',
  openMeteoArchive: 'ERA5 reanalysis via Open-Meteo',
  openMeteoMarine: 'Open-Meteo Marine · ECMWF WAM',
  openMeteoGeocoding: 'Open-Meteo Geocoding · GeoNames',
  openMeteoElevation: 'Copernicus DEM via Open-Meteo',
  usgs: 'USGS Earthquake Hazards Program',
  eonet: 'NASA EONET',
  firms: 'NASA FIRMS VIIRS',
  gdacs: 'GDACS (JRC / UN OCHA)',
  openSky: 'OpenSky Network',
  aisStream: 'AISStream · open AIS receivers',
  worldBank: 'World Bank Open Data',
  noaaSwpc: 'NOAA Space Weather Prediction Center',
  celestrak: 'CelesTrak TLE catalogue',
  issTracker: 'WhereTheISS.at',
  wikipedia: 'Wikipedia (CC BY-SA)',
  bigDataCloud: 'BigDataCloud reverse geocoder',
  aiService: 'Earth Digital Twin AI',
};

/** Full-jitter exponential backoff — avoids synchronised retry storms. */
export function jitteredBackoff(baseMs: number, attempt: number): number {
  const ceiling = Math.min(baseMs * 2 ** attempt, 10_000);
  return Math.round(Math.random() * ceiling);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
