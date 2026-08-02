import { Injectable } from '@nestjs/common';
import { haversineDistance, type LngLat, type Place, type PlaceKind } from '@edt/shared';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { UPSTREAM_URLS } from 'src/infra/upstream/providers';
import { UpstreamService } from 'src/infra/upstream/upstream.service';

export interface SearchOptions {
  q: string;
  limit: number;
  kinds?: string[];
  near?: LngLat;
}

interface GeocodeResponse {
  results?: {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    elevation?: number;
    feature_code?: string;
    country_code?: string;
    country?: string;
    admin1?: string;
    timezone?: string;
    population?: number;
  }[];
}

const FEATURE_KIND: Record<string, PlaceKind> = {
  PCLI: 'country',
  PCLD: 'country',
  ADM1: 'region',
  ADM2: 'region',
  PPLC: 'city',
  PPLA: 'city',
  PPLA2: 'city',
  PPLA3: 'city',
  PPL: 'town',
  PPLX: 'town',
  PPLL: 'village',
  AIRP: 'airport',
  PRT: 'seaport',
  MT: 'mountain',
  PK: 'mountain',
  ISL: 'island',
  LK: 'water',
  SEA: 'water',
  PRK: 'protected_area',
};

const COORDINATE_PATTERN = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/u;

/**
 * Unified place search.
 *
 * Local gazetteer first (trigram-ranked, no network), then the Open-Meteo
 * geocoder to cover the long tail. Raw coordinates are recognised directly so
 * "48.8584, 2.2945" resolves without a provider round-trip.
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly upstream: UpstreamService,
  ) {}

  async search(options: SearchOptions): Promise<Place[]> {
    const coordinate = this.parseCoordinate(options.q);
    if (coordinate) return [coordinate];

    const local = await this.searchLocal(options);
    if (local.length >= options.limit) return this.rank(local, options).slice(0, options.limit);

    const remote = await this.searchGeocoder(options.q, options.limit);
    const seen = new Set(
      local.map((place) => `${place.kind}:${place.name.toLowerCase()}:${place.countryCode ?? ''}`),
    );
    const merged = [
      ...local,
      ...remote.filter(
        (place) =>
          !seen.has(`${place.kind}:${place.name.toLowerCase()}:${place.countryCode ?? ''}`),
      ),
    ];
    return this.rank(merged, options).slice(0, options.limit);
  }

  /** Type-ahead suggestions: local data only, so it stays sub-10 ms. */
  async suggest(query: string, limit: number): Promise<Place[]> {
    return (await this.searchLocal({ q: query, limit })).slice(0, limit);
  }

  async reverse(point: LngLat): Promise<Place | null> {
    const [nearest] = await this.prisma.nearestCities(point.lng, point.lat, 1);
    if (nearest && nearest.distanceKm < 60) {
      const city = await this.prisma.city.findUnique({
        where: { id: nearest.id },
        include: { country: { select: { name: true } } },
      });
      if (city) {
        return {
          id: `city:${city.id}`,
          name: city.name,
          label: [city.name, city.admin1, city.country.name].filter(Boolean).join(', '),
          kind: city.isCapital ? 'city' : 'city',
          countryCode: city.countryCode,
          admin1: city.admin1 ?? undefined,
          population: city.population,
          timezone: city.timezone,
          center: { lng: city.lng, lat: city.lat },
        };
      }
    }

    const result = await this.upstream.safeJson<{
      city?: string;
      locality?: string;
      principalSubdivision?: string;
      countryName?: string;
      countryCode?: string;
    }>(
      {
        provider: 'bigDataCloud',
        url: UPSTREAM_URLS.reverseGeocode,
        retries: 1,
        query: { latitude: point.lat, longitude: point.lng, localityLanguage: 'en' },
      },
      {},
    );

    const name =
      result.data.city ??
      result.data.locality ??
      result.data.principalSubdivision ??
      result.data.countryName;
    if (!name) return null;
    return {
      id: `reverse:${point.lat.toFixed(3)},${point.lng.toFixed(3)}`,
      name,
      label: [name, result.data.principalSubdivision, result.data.countryName]
        .filter(Boolean)
        .join(', '),
      kind: result.data.city || result.data.locality ? 'city' : 'region',
      countryCode: result.data.countryCode,
      admin1: result.data.principalSubdivision,
      center: point,
    };
  }

  private async searchLocal(options: SearchOptions): Promise<Place[]> {
    const rows = await this.prisma.searchGazetteer(options.q, Math.min(50, options.limit * 3));
    const countryNames = new Map(
      (
        await this.prisma.country.findMany({
          where: { code: { in: [...new Set(rows.map((row) => row.countryCode))] } },
          select: { code: true, name: true },
        })
      ).map((country) => [country.code, country.name]),
    );

    return rows
      .map(
        (row): Place => ({
          id: `${row.kind}:${row.id}`,
          name: row.name,
          label:
            row.kind === 'country'
              ? row.name
              : [row.name, countryNames.get(row.countryCode) ?? row.countryCode]
                  .filter(Boolean)
                  .join(', '),
          kind: row.kind === 'country' ? 'country' : 'city',
          countryCode: row.countryCode,
          population: Math.round(row.population),
          center: { lng: row.lng, lat: row.lat },
          score: Math.min(1, Number(row.score)),
        }),
      )
      .filter(
        (place) =>
          !options.kinds || options.kinds.length === 0 || options.kinds.includes(place.kind),
      );
  }

  private async searchGeocoder(query: string, limit: number): Promise<Place[]> {
    const result = await this.upstream.safeJson<GeocodeResponse>(
      {
        provider: 'openMeteoGeocoding',
        url: UPSTREAM_URLS.openMeteoGeocoding,
        query: { name: query, count: Math.min(50, limit), language: 'en', format: 'json' },
      },
      {},
    );

    return (result.data.results ?? []).map((entry) => ({
      id: `geoname:${entry.id}`,
      name: entry.name,
      label: [entry.name, entry.admin1, entry.country].filter(Boolean).join(', '),
      kind: FEATURE_KIND[entry.feature_code ?? ''] ?? 'other',
      countryCode: entry.country_code,
      admin1: entry.admin1,
      population: entry.population,
      timezone: entry.timezone,
      center: { lng: entry.longitude, lat: entry.latitude },
      score: 0.5,
    }));
  }

  private parseCoordinate(query: string): Place | null {
    const match = COORDINATE_PATTERN.exec(query);
    if (!match) return null;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return {
      id: `coordinate:${lat},${lng}`,
      name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      label: `Coordinate ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      kind: 'coordinate',
      center: { lng, lat },
      score: 1,
    };
  }

  /**
   * Blend textual similarity, population weight and (when provided) proximity to
   * the current viewport centre.
   */
  private rank(places: Place[], options: SearchOptions): Place[] {
    const near = options.near;
    return places
      .map((place) => {
        const populationBoost = Math.min(0.25, Math.log10((place.population ?? 0) + 1) / 40);
        const proximityBoost = near
          ? Math.max(0, 0.2 - haversineDistance(near, place.center) / 20_000_000)
          : 0;
        return { place, score: (place.score ?? 0.4) + populationBoost + proximityBoost };
      })
      .sort((a, b) => b.score - a.score)
      .map((entry) => ({ ...entry.place, score: Number(Math.min(1, entry.score).toFixed(3)) }));
  }
}
