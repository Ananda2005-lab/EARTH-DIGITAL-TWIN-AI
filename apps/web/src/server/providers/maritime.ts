import type { BBox, Seaport, VesselFeed, VesselKind, VesselState } from '@edt/shared';
import { bboxContains, haversineDistance } from '@edt/shared';
import { fetchUpstream } from '../http';
import { cached, cacheKey } from '../cache';

/**
 * The world's busiest container ports with verified 2023 throughput. Bundled
 * because the underlying UNCTAD/Lloyd's dataset is annual, small and needs to
 * work offline.
 */
export const SEAPORTS: readonly (Seaport & { country: string; region: string })[] = [
  { code: 'CNSHA', name: 'Shanghai', countryCode: 'CN', country: 'China', region: 'East Asia', location: { lng: 121.8, lat: 31.23 }, teu: 49_160_000 },
  { code: 'SGSIN', name: 'Singapore', countryCode: 'SG', country: 'Singapore', region: 'Southeast Asia', location: { lng: 103.85, lat: 1.26 }, teu: 39_010_000 },
  { code: 'CNNGB', name: 'Ningbo-Zhoushan', countryCode: 'CN', country: 'China', region: 'East Asia', location: { lng: 121.85, lat: 29.87 }, teu: 35_300_000 },
  { code: 'CNSZX', name: 'Shenzhen', countryCode: 'CN', country: 'China', region: 'East Asia', location: { lng: 113.88, lat: 22.53 }, teu: 29_880_000 },
  { code: 'CNCAN', name: 'Guangzhou', countryCode: 'CN', country: 'China', region: 'East Asia', location: { lng: 113.43, lat: 22.79 }, teu: 25_410_000 },
  { code: 'KRPUS', name: 'Busan', countryCode: 'KR', country: 'South Korea', region: 'East Asia', location: { lng: 129.07, lat: 35.1 }, teu: 22_800_000 },
  { code: 'CNTAO', name: 'Qingdao', countryCode: 'CN', country: 'China', region: 'East Asia', location: { lng: 120.3, lat: 36.08 }, teu: 25_670_000 },
  { code: 'CNTXG', name: 'Tianjin', countryCode: 'CN', country: 'China', region: 'East Asia', location: { lng: 117.78, lat: 38.98 }, teu: 22_180_000 },
  { code: 'AEJEA', name: 'Jebel Ali (Dubai)', countryCode: 'AE', country: 'UAE', region: 'Middle East', location: { lng: 55.06, lat: 25.01 }, teu: 14_470_000 },
  { code: 'NLRTM', name: 'Rotterdam', countryCode: 'NL', country: 'Netherlands', region: 'Europe', location: { lng: 4.13, lat: 51.95 }, teu: 13_450_000 },
  { code: 'MYPKG', name: 'Port Klang', countryCode: 'MY', country: 'Malaysia', region: 'Southeast Asia', location: { lng: 101.36, lat: 3.0 }, teu: 14_060_000 },
  { code: 'HKHKG', name: 'Hong Kong', countryCode: 'HK', country: 'Hong Kong', region: 'East Asia', location: { lng: 114.13, lat: 22.31 }, teu: 14_340_000 },
  { code: 'BEANR', name: 'Antwerp-Bruges', countryCode: 'BE', country: 'Belgium', region: 'Europe', location: { lng: 4.32, lat: 51.28 }, teu: 12_520_000 },
  { code: 'MYTPP', name: 'Tanjung Pelepas', countryCode: 'MY', country: 'Malaysia', region: 'Southeast Asia', location: { lng: 103.55, lat: 1.36 }, teu: 10_500_000 },
  { code: 'USLAX', name: 'Los Angeles', countryCode: 'US', country: 'United States', region: 'North America', location: { lng: -118.26, lat: 33.73 }, teu: 8_630_000 },
  { code: 'USLGB', name: 'Long Beach', countryCode: 'US', country: 'United States', region: 'North America', location: { lng: -118.21, lat: 33.75 }, teu: 8_010_000 },
  { code: 'USNYC', name: 'New York / New Jersey', countryCode: 'US', country: 'United States', region: 'North America', location: { lng: -74.15, lat: 40.67 }, teu: 7_800_000 },
  { code: 'DEHAM', name: 'Hamburg', countryCode: 'DE', country: 'Germany', region: 'Europe', location: { lng: 9.93, lat: 53.53 }, teu: 7_700_000 },
  { code: 'INMUN', name: 'Mundra', countryCode: 'IN', country: 'India', region: 'South Asia', location: { lng: 69.72, lat: 22.84 }, teu: 7_400_000 },
  { code: 'ESVLC', name: 'Valencia', countryCode: 'ES', country: 'Spain', region: 'Europe', location: { lng: -0.32, lat: 39.44 }, teu: 4_800_000 },
  { code: 'GRPIR', name: 'Piraeus', countryCode: 'GR', country: 'Greece', region: 'Europe', location: { lng: 23.62, lat: 37.94 }, teu: 5_010_000 },
  { code: 'BRSSZ', name: 'Santos', countryCode: 'BR', country: 'Brazil', region: 'South America', location: { lng: -46.31, lat: -23.98 }, teu: 4_960_000 },
  { code: 'PAMIT', name: 'Colón (Panama)', countryCode: 'PA', country: 'Panama', region: 'Central America', location: { lng: -79.87, lat: 9.36 }, teu: 4_720_000 },
  { code: 'ZADUR', name: 'Durban', countryCode: 'ZA', country: 'South Africa', region: 'Africa', location: { lng: 31.03, lat: -29.87 }, teu: 2_580_000 },
  { code: 'EGPSD', name: 'Port Said', countryCode: 'EG', country: 'Egypt', region: 'Africa', location: { lng: 32.32, lat: 31.25 }, teu: 4_500_000 },
  { code: 'JPTYO', name: 'Tokyo', countryCode: 'JP', country: 'Japan', region: 'East Asia', location: { lng: 139.79, lat: 35.62 }, teu: 4_320_000 },
  { code: 'AUSYD', name: 'Port Botany (Sydney)', countryCode: 'AU', country: 'Australia', region: 'Oceania', location: { lng: 151.22, lat: -33.97 }, teu: 2_700_000 },
  { code: 'CAVAN', name: 'Vancouver', countryCode: 'CA', country: 'Canada', region: 'North America', location: { lng: -123.11, lat: 49.29 }, teu: 3_530_000 },
  { code: 'TRAMB', name: 'Ambarlı (Istanbul)', countryCode: 'TR', country: 'Türkiye', region: 'Europe', location: { lng: 28.69, lat: 40.97 }, teu: 3_100_000 },
  { code: 'MAPTM', name: 'Tanger Med', countryCode: 'MA', country: 'Morocco', region: 'Africa', location: { lng: -5.5, lat: 35.88 }, teu: 8_620_000 },
] as const;

/** Strategic maritime chokepoints monitored on the Ships dashboard. */
export const CHOKEPOINTS: readonly {
  id: string;
  name: string;
  location: { lng: number; lat: number };
  bbox: BBox;
  /** Share of global seaborne trade transiting the passage. */
  globalTradeSharePct: number;
  dailyTransits: number;
  minDepthM: number;
  note: string;
}[] = [
  {
    id: 'malacca',
    name: 'Strait of Malacca',
    location: { lng: 100.4, lat: 2.5 },
    bbox: [98.5, 0.5, 104.5, 6],
    globalTradeSharePct: 30,
    dailyTransits: 200,
    minDepthM: 25,
    note: 'Primary Indian Ocean–Pacific artery; 25 m draught limit forces VLCC rerouting.',
  },
  {
    id: 'suez',
    name: 'Suez Canal',
    location: { lng: 32.35, lat: 30.6 },
    bbox: [31.8, 29.7, 33.0, 31.6],
    globalTradeSharePct: 12,
    dailyTransits: 50,
    minDepthM: 24,
    note: 'Europe–Asia shortcut; disruption adds ~9 days via the Cape of Good Hope.',
  },
  {
    id: 'panama',
    name: 'Panama Canal',
    location: { lng: -79.7, lat: 9.1 },
    bbox: [-80.2, 8.6, -79.2, 9.6],
    globalTradeSharePct: 5,
    dailyTransits: 36,
    minDepthM: 15.2,
    note: 'Neopanamax locks; transit slots throttled during Gatún Lake droughts.',
  },
  {
    id: 'hormuz',
    name: 'Strait of Hormuz',
    location: { lng: 56.3, lat: 26.6 },
    bbox: [55.0, 25.5, 57.5, 27.5],
    globalTradeSharePct: 21,
    dailyTransits: 100,
    minDepthM: 60,
    note: 'Roughly a fifth of global petroleum liquids consumption passes through.',
  },
  {
    id: 'bab-el-mandeb',
    name: 'Bab el-Mandeb',
    location: { lng: 43.4, lat: 12.6 },
    bbox: [42.5, 11.5, 44.5, 13.8],
    globalTradeSharePct: 9,
    dailyTransits: 60,
    minDepthM: 30,
    note: 'Red Sea gateway feeding Suez; security risk drives insurance premiums.',
  },
  {
    id: 'gibraltar',
    name: 'Strait of Gibraltar',
    location: { lng: -5.6, lat: 35.95 },
    bbox: [-6.2, 35.6, -5.0, 36.3],
    globalTradeSharePct: 10,
    dailyTransits: 300,
    minDepthM: 300,
    note: 'Only Atlantic–Mediterranean link; heavy ferry and tanker cross traffic.',
  },
  {
    id: 'bosphorus',
    name: 'Bosphorus Strait',
    location: { lng: 29.05, lat: 41.1 },
    bbox: [28.8, 40.9, 29.3, 41.3],
    globalTradeSharePct: 3,
    dailyTransits: 120,
    minDepthM: 36,
    note: 'Black Sea grain and crude corridor with a 700 m minimum channel width.',
  },
  {
    id: 'dover',
    name: 'Dover Strait',
    location: { lng: 1.4, lat: 51.0 },
    bbox: [0.9, 50.7, 2.0, 51.4],
    globalTradeSharePct: 4,
    dailyTransits: 400,
    minDepthM: 24,
    note: 'Busiest shipping lane by transit count, with mandated traffic separation.',
  },
] as const;

const VESSEL_TYPE_MAP: { min: number; max: number; kind: VesselKind }[] = [
  { min: 20, max: 29, kind: 'other' },
  { min: 30, max: 30, kind: 'fishing' },
  { min: 31, max: 32, kind: 'tug' },
  { min: 33, max: 35, kind: 'military' },
  { min: 36, max: 36, kind: 'sailing' },
  { min: 37, max: 37, kind: 'pleasure' },
  { min: 40, max: 49, kind: 'high_speed' },
  { min: 50, max: 59, kind: 'other' },
  { min: 60, max: 69, kind: 'passenger' },
  { min: 70, max: 79, kind: 'cargo' },
  { min: 80, max: 89, kind: 'tanker' },
];

export function vesselKindFromAisType(type: number | null | undefined): VesselKind {
  if (type === null || type === undefined) return 'other';
  const match = VESSEL_TYPE_MAP.find((row) => type >= row.min && type <= row.max);
  return match?.kind ?? 'other';
}

/**
 * AIS positions are relayed by the NestJS gateway, which holds the single
 * long-lived AISStream websocket and de-duplicates positions into Redis. The web
 * tier only ever reads a snapshot, so serverless instances never open sockets.
 */
export async function getVessels(options: { bbox?: BBox; limit?: number } = {}): Promise<VesselFeed> {
  const { bbox, limit = 1000 } = options;
  const apiBase = process.env.API_BASE_URL;
  const configured = Boolean(process.env.AISSTREAM_API_KEY);
  const key = cacheKey('ais:snapshot', { bbox: bbox?.join(',') ?? 'global' });

  if (!apiBase || !configured) {
    return {
      vessels: [],
      total: 0,
      bbox,
      attribution: 'AIS relay not configured — set AISSTREAM_API_KEY on the gateway',
      fetchedAt: new Date().toISOString(),
    };
  }

  return cached(key, 20, async () => {
    try {
      const url = new URL(`${apiBase.replace(/\/$/, '')}/ships/live`);
      if (bbox) url.searchParams.set('bbox', bbox.join(','));
      url.searchParams.set('limit', String(limit));
      const raw = await fetchUpstream<{ data: VesselFeed }>(url.toString(), {
        provider: 'AIS relay',
        revalidate: 20,
        retries: 1,
      });
      const feed = raw.data ?? { vessels: [], total: 0, attribution: 'AIS relay', fetchedAt: new Date().toISOString() };
      const vessels = bbox ? feed.vessels.filter((v) => bboxContains(bbox, v.position)) : feed.vessels;
      return { ...feed, vessels: vessels.slice(0, limit), total: vessels.length, bbox };
    } catch {
      return {
        vessels: [] as VesselState[],
        total: 0,
        bbox,
        attribution: 'AIS relay unavailable',
        fetchedAt: new Date().toISOString(),
      };
    }
  });
}

export function nearestPorts(point: { lng: number; lat: number }, count = 5) {
  return [...SEAPORTS]
    .map((port) => ({ port, distanceM: haversineDistance(point, port.location) }))
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, count);
}

export interface PortActivity {
  port: (typeof SEAPORTS)[number];
  /** Vessels currently inside a 30 km radius of the port centroid. */
  vesselsInRange: number;
  /** Rolling proxy for congestion: anchored vessels over moving vessels. */
  congestionIndex: number;
}

/** Derive per-port activity from whatever AIS snapshot is available. */
export function computePortActivity(vessels: VesselState[]): PortActivity[] {
  return SEAPORTS.map((port) => {
    const inRange = vessels.filter((v) => haversineDistance(v.position, port.location) < 30_000);
    const anchored = inRange.filter((v) => (v.sog ?? 0) < 1).length;
    return {
      port,
      vesselsInRange: inRange.length,
      congestionIndex: inRange.length === 0 ? 0 : +(anchored / inRange.length).toFixed(2),
    };
  }).sort((a, b) => b.vesselsInRange - a.vesselsInRange);
}
