import type { BBox, HazardEvent, HazardFeed, HazardKind, HazardSeverity } from '@edt/shared';
import { HAZARD_SEVERITY_ORDER, bboxContains } from '@edt/shared';
import { buildUrl, fetchText, fetchUpstream, parseCsv } from '../http';
import { cached, cacheKey } from '../cache';

// ── USGS earthquakes ─────────────────────────────────────────────────────────

interface UsgsFeature {
  id: string;
  properties: {
    mag: number | null;
    place: string | null;
    time: number;
    updated: number;
    tsunami: number;
    url: string;
    type: string;
    title: string;
  };
  geometry: { coordinates: [number, number, number] } | null;
}

function earthquakeSeverity(magnitude: number): HazardSeverity {
  if (magnitude >= 7) return 'extreme';
  if (magnitude >= 6) return 'high';
  if (magnitude >= 4.5) return 'moderate';
  if (magnitude >= 3) return 'low';
  return 'info';
}

export async function getEarthquakes(
  options: {
    hours?: number;
    minMagnitude?: number;
    bbox?: BBox;
    limit?: number;
  } = {},
): Promise<HazardEvent[]> {
  const { hours = 24, minMagnitude = 1.5, bbox, limit = 1000 } = options;
  const key = cacheKey('usgs:quakes', { hours, minMagnitude, limit });
  const events = await cached(key, 300, async () => {
    const start = new Date(Date.now() - hours * 3_600_000).toISOString();
    const url = buildUrl('https://earthquake.usgs.gov/fdsnws/event/1/query', {
      format: 'geojson',
      starttime: start,
      minmagnitude: minMagnitude,
      orderby: 'time',
      limit: Math.min(limit, 2000),
    });
    const raw = await fetchUpstream<{ features: UsgsFeature[] }>(url, {
      provider: 'USGS',
      revalidate: 300,
    });
    return (raw.features ?? [])
      .filter((f) => f.geometry?.coordinates)
      .map((f) => {
        const [lng, lat, depth] = f.geometry!.coordinates;
        const magnitude = f.properties.mag ?? 0;
        return {
          id: `eq:${f.id}`,
          kind: 'earthquake' as HazardKind,
          title: f.properties.title || `M${magnitude.toFixed(1)} earthquake`,
          severity: earthquakeSeverity(magnitude),
          intensity: Math.min(1, magnitude / 9),
          location: { lng, lat },
          depthKm: Math.max(0, depth ?? 0),
          magnitude,
          place: f.properties.place ?? undefined,
          startedAt: new Date(f.properties.time).toISOString(),
          updatedAt: new Date(f.properties.updated ?? f.properties.time).toISOString(),
          source: 'USGS Earthquake Hazards Program',
          sourceUrl: f.properties.url,
          tsunamiWarning: f.properties.tsunami === 1,
        } satisfies HazardEvent;
      });
  });
  return bbox ? events.filter((e) => bboxContains(bbox, e.location)) : events;
}

// ── NASA EONET (volcanoes, storms, ice, dust, floods, wildfires) ─────────────

interface EonetEvent {
  id: string;
  title: string;
  description: string | null;
  link: string;
  closed: string | null;
  categories: { id: string; title: string }[];
  geometry: {
    date: string;
    type: string;
    coordinates: number[] | number[][] | number[][][];
    magnitudeValue?: number;
    magnitudeUnit?: string;
  }[];
}

const EONET_CATEGORY_MAP: Record<string, HazardKind> = {
  volcanoes: 'volcano',
  wildfires: 'wildfire',
  severeStorms: 'cyclone',
  floods: 'flood',
  drought: 'drought',
  landslides: 'landslide',
  seaLakeIce: 'flood',
};

export async function getEonetEvents(
  options: { days?: number; limit?: number } = {},
): Promise<HazardEvent[]> {
  const { days = 30, limit = 500 } = options;
  const key = cacheKey('eonet:events', { days, limit });
  return cached(key, 1800, async () => {
    const url = buildUrl('https://eonet.gsfc.nasa.gov/api/v3/events', {
      days,
      limit,
      status: 'open',
    });
    const raw = await fetchUpstream<{ events: EonetEvent[] }>(url, {
      provider: 'NASA EONET',
      revalidate: 1800,
    });

    const events: HazardEvent[] = [];
    for (const event of raw.events ?? []) {
      const category = event.categories?.[0]?.id ?? '';
      const kind = EONET_CATEGORY_MAP[category];
      if (!kind) continue;
      const geometry = event.geometry?.[event.geometry.length - 1];
      if (!geometry) continue;
      const point = firstPoint(geometry.coordinates);
      if (!point) continue;
      const magnitude = geometry.magnitudeValue;
      events.push({
        id: `eonet:${event.id}`,
        kind,
        title: event.title,
        severity: eonetSeverity(kind, magnitude),
        intensity: normaliseIntensity(kind, magnitude),
        location: point,
        magnitude,
        startedAt: event.geometry?.[0]?.date ?? geometry.date,
        updatedAt: geometry.date,
        source: 'NASA EONET',
        sourceUrl: event.link,
      });
    }
    return events;
  });
}

function firstPoint(coordinates: unknown): { lng: number; lat: number } | null {
  if (
    Array.isArray(coordinates) &&
    typeof coordinates[0] === 'number' &&
    typeof coordinates[1] === 'number'
  ) {
    return { lng: coordinates[0], lat: coordinates[1] };
  }
  if (Array.isArray(coordinates) && coordinates.length > 0) {
    return firstPoint(coordinates[0]);
  }
  return null;
}

function eonetSeverity(kind: HazardKind, magnitude?: number): HazardSeverity {
  if (kind === 'cyclone' && magnitude !== undefined) {
    if (magnitude >= 115) return 'extreme';
    if (magnitude >= 95) return 'high';
    if (magnitude >= 64) return 'moderate';
    return 'low';
  }
  if (kind === 'volcano') return 'high';
  if (kind === 'flood') return 'high';
  if (kind === 'wildfire') return 'moderate';
  return 'moderate';
}

function normaliseIntensity(kind: HazardKind, magnitude?: number): number {
  if (magnitude === undefined) return kind === 'volcano' || kind === 'flood' ? 0.6 : 0.45;
  if (kind === 'cyclone') return Math.min(1, magnitude / 160);
  return Math.min(1, magnitude / 100);
}

// ── NASA FIRMS active fire detections ────────────────────────────────────────

export async function getWildfires(
  options: { bbox?: BBox; days?: 1 | 2 | 3; limit?: number } = {},
): Promise<HazardEvent[]> {
  const apiKey = process.env.NASA_FIRMS_API_KEY;
  if (!apiKey) return [];
  const { bbox = [-180, -90, 180, 90] as BBox, days = 1, limit = 2000 } = options;
  const area = `${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}`;
  const key = cacheKey('firms:fires', { area, days });
  const events = await cached(key, 900, async () => {
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${apiKey}/VIIRS_SNPP_NRT/${area}/${days}`;
    const csv = await fetchText(url, { provider: 'NASA FIRMS', revalidate: 900, retries: 1 });
    return parseCsv(csv)
      .map((row, index): HazardEvent | null => {
        const lat = Number(row.latitude);
        const lng = Number(row.longitude);
        const frp = Number(row.frp);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const acquired = `${row.acq_date ?? ''}T${(row.acq_time ?? '0000').padStart(4, '0').replace(/(\d{2})(\d{2})/, '$1:$2')}:00Z`;
        return {
          id: `fire:${row.latitude}:${row.longitude}:${row.acq_date}:${row.acq_time}:${index}`,
          kind: 'wildfire' as HazardKind,
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
      .filter((e): e is HazardEvent => e !== null)
      .slice(0, limit);
  });
  return events;
}

// ── Smithsonian / weekly volcanic activity via GDACS ─────────────────────────

interface GdacsFeature {
  properties: {
    eventid: number | string;
    eventtype: string;
    eventname?: string;
    htmldescription?: string;
    alertlevel?: string;
    severitydata?: { severity?: number; severitytext?: string };
    fromdate?: string;
    todate?: string;
    country?: string;
    iso3?: string;
    url?: { report?: string };
    population?: { value?: number };
  };
  geometry: { type: string; coordinates: [number, number] } | null;
}

const GDACS_TYPE_MAP: Record<string, HazardKind> = {
  EQ: 'earthquake',
  TC: 'cyclone',
  FL: 'flood',
  VO: 'volcano',
  DR: 'drought',
  WF: 'wildfire',
  TS: 'tsunami',
};

const GDACS_ALERT_SEVERITY: Record<string, HazardSeverity> = {
  Green: 'low',
  Orange: 'high',
  Red: 'extreme',
};

export async function getGdacsEvents(options: { limit?: number } = {}): Promise<HazardEvent[]> {
  const { limit = 300 } = options;
  const key = cacheKey('gdacs:events', { limit });
  return cached(key, 1800, async () => {
    const url = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP';
    try {
      const raw = await fetchUpstream<{ features: GdacsFeature[] }>(url, {
        provider: 'GDACS',
        revalidate: 1800,
        retries: 1,
      });
      return (raw.features ?? [])
        .map((feature): HazardEvent | null => {
          const props = feature.properties;
          const kind = GDACS_TYPE_MAP[props.eventtype];
          const coordinates = feature.geometry?.coordinates;
          if (!kind || !coordinates) return null;
          const severity = GDACS_ALERT_SEVERITY[props.alertlevel ?? 'Green'] ?? 'moderate';
          return {
            id: `gdacs:${props.eventtype}:${props.eventid}`,
            kind,
            title: props.eventname || stripHtml(props.htmldescription) || `${kind} event`,
            severity,
            intensity: severity === 'extreme' ? 0.95 : severity === 'high' ? 0.7 : 0.4,
            location: { lng: coordinates[0], lat: coordinates[1] },
            affectedPopulation: props.population?.value,
            place: props.country,
            countryCode: props.iso3?.slice(0, 2),
            startedAt: props.fromdate ?? new Date().toISOString(),
            updatedAt: props.todate ?? props.fromdate ?? new Date().toISOString(),
            source: 'GDACS (JRC / UN OCHA)',
            sourceUrl: props.url?.report,
          };
        })
        .filter((e): e is HazardEvent => e !== null)
        .slice(0, limit);
    } catch {
      return [];
    }
  });
}

function stripHtml(input?: string): string {
  return (input ?? '').replace(/<[^>]*>/g, '').trim();
}

// ── Fusion ───────────────────────────────────────────────────────────────────

export interface HazardFetchOptions {
  kinds?: HazardKind[];
  bbox?: BBox;
  hours?: number;
  minMagnitude?: number;
  minSeverity?: HazardSeverity;
  limit?: number;
}

/**
 * Multi-provider hazard fusion. Each source is fetched in parallel and failures
 * degrade gracefully: one dead provider never takes the feed down.
 */
export async function getHazardFeed(options: HazardFetchOptions = {}): Promise<HazardFeed> {
  const { kinds, bbox, hours = 24, minMagnitude, minSeverity, limit = 800 } = options;
  const wants = (kind: HazardKind) => !kinds || kinds.length === 0 || kinds.includes(kind);

  const tasks: Promise<HazardEvent[]>[] = [];
  if (wants('earthquake'))
    tasks.push(getEarthquakes({ hours, minMagnitude, bbox }).catch(() => []));
  if (wants('wildfire')) tasks.push(getWildfires({ bbox }).catch(() => []));
  if (
    wants('volcano') ||
    wants('cyclone') ||
    wants('flood') ||
    wants('drought') ||
    wants('landslide')
  ) {
    tasks.push(getEonetEvents({ days: Math.max(1, Math.ceil(hours / 24)) }).catch(() => []));
    tasks.push(getGdacsEvents().catch(() => []));
  }

  const results = await Promise.all(tasks);
  const seen = new Set<string>();
  let events = results
    .flat()
    .filter((event) => {
      if (!wants(event.kind)) return false;
      if (bbox && !bboxContains(bbox, event.location)) return false;
      if (
        minSeverity &&
        HAZARD_SEVERITY_ORDER.indexOf(event.severity) < HAZARD_SEVERITY_ORDER.indexOf(minSeverity)
      ) {
        return false;
      }
      // De-duplicate the same physical event reported by multiple providers.
      // Coerced with `Number(...)` because upstream JSON (GDACS in particular)
      // does not always guarantee numeric types for coordinate fields.
      const lat = Number(event.location.lat).toFixed(1);
      const lng = Number(event.location.lng).toFixed(1);
      const bucket = `${event.kind}:${lat}:${lng}:${event.startedAt.slice(0, 13)}`;
      if (seen.has(bucket)) return false;
      seen.add(bucket);
      return true;
    })
    .sort((a, b) => {
      const severityDelta =
        HAZARD_SEVERITY_ORDER.indexOf(b.severity) - HAZARD_SEVERITY_ORDER.indexOf(a.severity);
      if (severityDelta !== 0) return severityDelta;
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
    });

  const total = events.length;
  events = events.slice(0, limit);

  return {
    events,
    total,
    window: {
      from: new Date(Date.now() - hours * 3_600_000).toISOString(),
      to: new Date().toISOString(),
    },
    attribution: 'USGS · NASA EONET · NASA FIRMS · GDACS',
    fetchedAt: new Date().toISOString(),
  };
}
