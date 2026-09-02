import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HAZARD_SEVERITY_ORDER,
  bboxContains,
  haversineDistance,
  type BBox,
  type HazardEvent,
  type HazardFeed,
  type HazardKind,
  type HazardSeverity,
  type HazardStats,
  type LngLat,
} from '@edt/shared';
import type { AppConfig } from 'src/config/configuration';
import { parseCsv } from 'src/infra/upstream/upstream.service';
import { UPSTREAM_URLS } from 'src/infra/upstream/providers';
import { UpstreamService } from 'src/infra/upstream/upstream.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';

export interface HazardFeedQuery {
  kinds?: HazardKind[];
  bbox?: BBox;
  minMagnitude?: number;
  minSeverity?: HazardSeverity;
  hours: number;
  limit: number;
}

interface UsgsFeature {
  id: string;
  properties: {
    mag: number | null;
    place: string | null;
    time: number;
    updated: number | null;
    tsunami: number;
    url: string;
    title: string;
  };
  geometry: { coordinates: [number, number, number] } | null;
}

interface EonetEvent {
  id: string;
  title: string;
  link: string;
  categories: { id: string }[];
  geometry: { date: string; coordinates: unknown; magnitudeValue?: number }[];
}

interface GdacsFeature {
  properties: {
    eventid: number | string;
    eventtype: string;
    eventname?: string;
    htmldescription?: string;
    alertlevel?: string;
    fromdate?: string;
    todate?: string;
    country?: string;
    iso3?: string;
    url?: { report?: string };
    population?: { value?: number };
  };
  geometry: { coordinates: [number, number] } | null;
}

const EONET_CATEGORIES: Record<string, HazardKind> = {
  volcanoes: 'volcano',
  wildfires: 'wildfire',
  severeStorms: 'cyclone',
  floods: 'flood',
  drought: 'drought',
  landslides: 'landslide',
  seaLakeIce: 'flood',
};

const GDACS_TYPES: Record<string, HazardKind> = {
  EQ: 'earthquake',
  TC: 'cyclone',
  FL: 'flood',
  VO: 'volcano',
  DR: 'drought',
  WF: 'wildfire',
  TS: 'tsunami',
};

const GDACS_SEVERITY: Record<string, HazardSeverity> = {
  Green: 'low',
  Orange: 'high',
  Red: 'extreme',
};

/**
 * Multi-provider hazard fusion.
 *
 * Sources are fetched in parallel and every one is optional: a dead provider
 * removes its events from the feed instead of failing the request. Duplicate
 * reports of the same physical event (USGS + GDACS both publish quakes) are
 * collapsed on a coarse space/time bucket.
 */
@Injectable()
export class HazardsService {
  private readonly logger = new Logger(HazardsService.name);

  constructor(
    private readonly upstream: UpstreamService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async feed(query: HazardFeedQuery): Promise<HazardFeed> {
    const wants = (kind: HazardKind): boolean =>
      !query.kinds || query.kinds.length === 0 || query.kinds.includes(kind);

    const tasks: Promise<HazardEvent[]>[] = [];
    if (wants('earthquake'))
      tasks.push(this.earthquakes(query.hours, query.minMagnitude, query.bbox));
    if (wants('wildfire')) tasks.push(this.wildfires(query.bbox));
    if (
      ['volcano', 'cyclone', 'flood', 'drought', 'landslide', 'tsunami'].some((kind) =>
        wants(kind as HazardKind),
      )
    ) {
      tasks.push(this.eonet(Math.max(1, Math.ceil(query.hours / 24))));
      tasks.push(this.gdacs());
    }

    const results = await Promise.all(tasks);
    const seen = new Set<string>();
    const since = Date.now() - query.hours * 3_600_000;

    const events = results
      .flat()
      .filter((event) => {
        if (!wants(event.kind)) return false;
        if (query.bbox && !bboxContains(query.bbox, event.location)) return false;
        if (new Date(event.startedAt).getTime() < since) return false;
        if (
          query.minSeverity &&
          HAZARD_SEVERITY_ORDER.indexOf(event.severity) <
            HAZARD_SEVERITY_ORDER.indexOf(query.minSeverity)
        ) {
          return false;
        }
        const lat = Number(event.location.lat);
        const lng = Number(event.location.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
        const bucket = `${event.kind}:${lat.toFixed(1)}:${lng.toFixed(1)}:${event.startedAt.slice(0, 13)}`;
        if (seen.has(bucket)) return false;
        seen.add(bucket);
        return true;
      })
      .sort((a, b) => {
        const bySeverity =
          HAZARD_SEVERITY_ORDER.indexOf(b.severity) - HAZARD_SEVERITY_ORDER.indexOf(a.severity);
        if (bySeverity !== 0) return bySeverity;
        return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
      });

    return {
      events: events.slice(0, query.limit),
      total: events.length,
      window: { from: new Date(since).toISOString(), to: new Date().toISOString() },
      attribution: 'USGS · NASA EONET · NASA FIRMS · GDACS',
      fetchedAt: new Date().toISOString(),
    };
  }

  async stats(query: HazardFeedQuery): Promise<HazardStats[]> {
    const { events } = await this.feed({ ...query, limit: 5000 });
    const grouped = new Map<HazardKind, HazardStats>();
    for (const event of events) {
      const existing =
        grouped.get(event.kind) ??
        ({
          kind: event.kind,
          count: 0,
          maxIntensity: 0,
          bySeverity: { info: 0, low: 0, moderate: 0, high: 0, extreme: 0 },
        } satisfies HazardStats);
      existing.count += 1;
      existing.maxIntensity = Math.max(existing.maxIntensity, event.intensity);
      existing.bySeverity[event.severity] += 1;
      grouped.set(event.kind, existing);
    }
    return [...grouped.values()].sort((a, b) => b.count - a.count);
  }

  /** Events within `radiusKm` of a point, nearest first. */
  async nearby(
    point: LngLat,
    radiusKm: number,
    hours: number,
  ): Promise<(HazardEvent & { distanceKm: number })[]> {
    const { events } = await this.feed({ hours, limit: 3000 });
    return events
      .map((event) => ({
        ...event,
        distanceKm: Number((haversineDistance(point, event.location) / 1000).toFixed(1)),
      }))
      .filter((event) => event.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  /**
   * Persist the current feed so alert fan-out and history survive a cache flush.
   * Returns the events that had not been seen before.
   */
  async syncCache(hours = 6): Promise<HazardEvent[]> {
    const { events } = await this.feed({ hours, limit: 2000 });
    const fresh: HazardEvent[] = [];
    const expiresAt = new Date(Date.now() + 30 * 86_400_000);

    for (const event of events) {
      const existing = await this.prisma.hazardEventCache.findUnique({
        where: { externalId: event.id },
        select: { id: true },
      });
      await this.prisma.hazardEventCache.upsert({
        where: { externalId: event.id },
        create: {
          externalId: event.id,
          kind: event.kind,
          title: event.title.slice(0, 500),
          severity: event.severity,
          intensity: Math.min(1, Math.max(0, event.intensity)),
          lng: event.location.lng,
          lat: event.location.lat,
          depthKm: event.depthKm ?? null,
          magnitude: event.magnitude ?? null,
          frpMw: event.frpMw ?? null,
          affectedPopulation: event.affectedPopulation ?? null,
          place: event.place ?? null,
          countryCode: event.countryCode?.slice(0, 2).toUpperCase() ?? null,
          tsunamiWarning: event.tsunamiWarning ?? false,
          source: event.source,
          sourceUrl: event.sourceUrl ?? null,
          startedAt: new Date(event.startedAt),
          sourceUpdatedAt: new Date(event.updatedAt),
          expiresAt,
        },
        update: {
          severity: event.severity,
          intensity: Math.min(1, Math.max(0, event.intensity)),
          title: event.title.slice(0, 500),
          sourceUpdatedAt: new Date(event.updatedAt),
          expiresAt,
        },
      });
      if (!existing) fresh.push(event);
    }

    this.logger.log(`Hazard cache synced: ${events.length} events, ${fresh.length} new`);
    return fresh;
  }

  async pruneCache(): Promise<number> {
    const result = await this.prisma.hazardEventCache.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }

  // ── Providers ──────────────────────────────────────────────────────────────

  private async earthquakes(
    hours: number,
    minMagnitude?: number,
    bbox?: BBox,
  ): Promise<HazardEvent[]> {
    const result = await this.upstream.safeJson<{ features?: UsgsFeature[] }>(
      {
        provider: 'usgs',
        url: UPSTREAM_URLS.usgsQuery,
        query: {
          format: 'geojson',
          starttime: new Date(Date.now() - hours * 3_600_000).toISOString(),
          minmagnitude: minMagnitude ?? 1.5,
          orderby: 'time',
          limit: 2000,
          minlongitude: bbox?.[0],
          minlatitude: bbox?.[1],
          maxlongitude: bbox?.[2],
          maxlatitude: bbox?.[3],
        },
      },
      {},
    );

    return (result.data.features ?? [])
      .filter((feature) => feature.geometry?.coordinates)
      .map((feature) => {
        const [lng, lat, depth] = feature.geometry?.coordinates ?? [0, 0, 0];
        const magnitude = feature.properties.mag ?? 0;
        return {
          id: `eq:${feature.id}`,
          kind: 'earthquake',
          title: feature.properties.title || `M${magnitude.toFixed(1)} earthquake`,
          severity: earthquakeSeverity(magnitude),
          intensity: Math.min(1, magnitude / 9),
          location: { lng, lat },
          depthKm: Math.max(0, depth ?? 0),
          magnitude,
          place: feature.properties.place ?? undefined,
          startedAt: new Date(feature.properties.time).toISOString(),
          updatedAt: new Date(feature.properties.updated ?? feature.properties.time).toISOString(),
          source: 'USGS Earthquake Hazards Program',
          sourceUrl: feature.properties.url,
          tsunamiWarning: feature.properties.tsunami === 1,
        } satisfies HazardEvent;
      });
  }

  private async wildfires(bbox?: BBox): Promise<HazardEvent[]> {
    const apiKey = this.config.get('upstream', { infer: true }).keys.nasaFirms;
    if (!apiKey) return [];
    const area = (bbox ?? [-180, -90, 180, 90]).join(',');

    const result = await this.upstream.safeText({
      provider: 'firms',
      url: `${UPSTREAM_URLS.firmsArea}/${apiKey}/VIIRS_SNPP_NRT/${area}/1`,
      retries: 1,
      cacheKey: area,
    });
    if (!result.data) return [];

    return parseCsv(result.data)
      .map((row): HazardEvent | null => {
        const lat = Number(row.latitude);
        const lng = Number(row.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const frp = Number(row.frp);
        const time = (row.acq_time ?? '0000').padStart(4, '0');
        const acquired = `${row.acq_date ?? new Date().toISOString().slice(0, 10)}T${time.slice(0, 2)}:${time.slice(2, 4)}:00Z`;
        return {
          id: `fire:${row.latitude}:${row.longitude}:${row.acq_date}:${row.acq_time}`,
          kind: 'wildfire',
          title: `Active fire · ${Number.isFinite(frp) ? `${frp.toFixed(0)} MW` : (row.confidence ?? 'detected')}`,
          severity: frp >= 200 ? 'extreme' : frp >= 80 ? 'high' : frp >= 20 ? 'moderate' : 'low',
          intensity: Math.min(1, (Number.isFinite(frp) ? frp : 10) / 300),
          location: { lng, lat },
          frpMw: Number.isFinite(frp) ? frp : undefined,
          startedAt: acquired,
          updatedAt: acquired,
          source: 'NASA FIRMS VIIRS',
          sourceUrl: 'https://firms.modaps.eosdis.nasa.gov/',
        };
      })
      .filter((event): event is HazardEvent => event !== null)
      .slice(0, 2000);
  }

  private async eonet(days: number): Promise<HazardEvent[]> {
    const result = await this.upstream.safeJson<{ events?: EonetEvent[] }>(
      {
        provider: 'eonet',
        url: UPSTREAM_URLS.eonetEvents,
        query: { days: Math.min(60, days), limit: 500, status: 'open' },
      },
      {},
    );

    const events: HazardEvent[] = [];
    for (const event of result.data.events ?? []) {
      const kind = EONET_CATEGORIES[event.categories?.[0]?.id ?? ''];
      if (!kind) continue;
      const geometry = event.geometry?.[event.geometry.length - 1];
      const point = firstPoint(geometry?.coordinates);
      if (!geometry || !point) continue;
      const magnitude = geometry.magnitudeValue;
      events.push({
        id: `eonet:${event.id}`,
        kind,
        title: event.title,
        severity: eonetSeverity(kind, magnitude),
        intensity: eonetIntensity(kind, magnitude),
        location: point,
        magnitude,
        startedAt: event.geometry?.[0]?.date ?? geometry.date,
        updatedAt: geometry.date,
        source: 'NASA EONET',
        sourceUrl: event.link,
      });
    }
    return events;
  }

  private async gdacs(): Promise<HazardEvent[]> {
    const result = await this.upstream.safeJson<{ features?: GdacsFeature[] }>(
      { provider: 'gdacs', url: UPSTREAM_URLS.gdacsEvents, retries: 1 },
      {},
    );

    return (result.data.features ?? [])
      .map((feature): HazardEvent | null => {
        const properties = feature.properties;
        const kind = GDACS_TYPES[properties.eventtype];
        if (!kind) return null;
        // GDACS occasionally serves coordinates as a comma-joined string
        // ("lng,lat") or omits the latitude entirely — normalise to numbers.
        const raw = feature.geometry?.coordinates;
        const point = parseCoordinates(raw);
        if (!point) return null;
        const severity = GDACS_SEVERITY[properties.alertlevel ?? 'Green'] ?? 'moderate';
        return {
          id: `gdacs:${properties.eventtype}:${properties.eventid}`,
          kind,
          title: properties.eventname || stripHtml(properties.htmldescription) || `${kind} event`,
          severity,
          intensity: severity === 'extreme' ? 0.95 : severity === 'high' ? 0.7 : 0.4,
          location: point,
          affectedPopulation: properties.population?.value,
          place: properties.country,
          countryCode: properties.iso3?.slice(0, 2),
          startedAt: properties.fromdate ?? new Date().toISOString(),
          updatedAt: properties.todate ?? properties.fromdate ?? new Date().toISOString(),
          source: 'GDACS (JRC / UN OCHA)',
          sourceUrl: properties.url?.report,
        };
      })
      .filter((event): event is HazardEvent => event !== null);
  }
}

function earthquakeSeverity(magnitude: number): HazardSeverity {
  if (magnitude >= 7) return 'extreme';
  if (magnitude >= 6) return 'high';
  if (magnitude >= 4.5) return 'moderate';
  if (magnitude >= 3) return 'low';
  return 'info';
}

function eonetSeverity(kind: HazardKind, magnitude?: number): HazardSeverity {
  if (kind === 'cyclone' && magnitude !== undefined) {
    if (magnitude >= 115) return 'extreme';
    if (magnitude >= 95) return 'high';
    if (magnitude >= 64) return 'moderate';
    return 'low';
  }
  if (kind === 'volcano' || kind === 'flood') return 'high';
  return 'moderate';
}

function eonetIntensity(kind: HazardKind, magnitude?: number): number {
  if (magnitude === undefined) return kind === 'volcano' || kind === 'flood' ? 0.6 : 0.45;
  if (kind === 'cyclone') return Math.min(1, magnitude / 160);
  return Math.min(1, magnitude / 100);
}

function firstPoint(coordinates: unknown): LngLat | null {
  if (
    Array.isArray(coordinates) &&
    typeof coordinates[0] === 'number' &&
    typeof coordinates[1] === 'number'
  ) {
    return { lng: coordinates[0], lat: coordinates[1] };
  }
  if (Array.isArray(coordinates) && coordinates.length > 0) return firstPoint(coordinates[0]);
  return null;
}

/** GDACS coordinates may be `[lng, lat]`, a nested ring, or a "lng,lat" string. */
function parseCoordinates(raw: unknown): LngLat | null {
  if (typeof raw === 'string') {
    const parts = raw.split(',').map((part) => Number(part.trim()));
    const lng = parts[0];
    const lat = parts[1];
    if (typeof lng !== 'number' || typeof lat !== 'number') return null;
    if (Number.isFinite(lng) && Number.isFinite(lat)) return { lng, lat };
    return null;
  }
  return firstPoint(raw);
}

function stripHtml(input?: string): string {
  return (input ?? '').replace(/<[^>]*>/gu, '').trim();
}
