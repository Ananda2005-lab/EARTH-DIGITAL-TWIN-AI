import type { Airport, BBox, FlightFeed, FlightPhase, FlightState } from '@edt/shared';
import { bboxContains } from '@edt/shared';
import { buildUrl, fetchUpstream } from '../http';
import { cached, cacheKey } from '../cache';

const OPENSKY_STATES = 'https://opensky-network.org/api/states/all';
const OPENSKY_TOKEN_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

/**
 * OpenSky state vector tuple layout (index → field), per their REST docs.
 * Kept as a named map so the parser stays readable.
 */
const enum S {
  Icao24 = 0,
  Callsign = 1,
  OriginCountry = 2,
  TimePosition = 3,
  LastContact = 4,
  Longitude = 5,
  Latitude = 6,
  BaroAltitude = 7,
  OnGround = 8,
  Velocity = 9,
  TrueTrack = 10,
  VerticalRate = 11,
  GeoAltitude = 13,
  Squawk = 14,
  Spi = 15,
}

type StateVector = (number | string | boolean | null)[];

let tokenCache: { token: string; expiresAt: number } | null = null;

/** OAuth2 client-credentials token for the higher OpenSky rate limit. */
async function getOpenSkyToken(): Promise<string | null> {
  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.token;

  try {
    const response = await fetch(OPENSKY_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;
    tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 1800) * 1000,
    };
    return tokenCache.token;
  } catch {
    return null;
  }
}

function derivePhase(onGround: boolean, verticalRate: number | null, altitude: number | null): FlightPhase {
  if (onGround) return 'ground';
  if (verticalRate === null || altitude === null) return 'unknown';
  if (verticalRate > 2.5) return 'climb';
  if (verticalRate < -2.5) return 'descent';
  if (altitude > 6000) return 'cruise';
  return 'unknown';
}

export async function getFlights(options: { bbox?: BBox; limit?: number } = {}): Promise<FlightFeed> {
  const { bbox, limit = 1500 } = options;
  const key = cacheKey('opensky:states', {
    bbox: bbox ? bbox.map((n) => Math.round(n * 10) / 10).join(',') : 'global',
  });

  const feed = await cached(key, 12, async () => {
    const token = await getOpenSkyToken();
    const url = bbox
      ? buildUrl(OPENSKY_STATES, {
          lamin: Math.max(-90, bbox[1]),
          lomin: Math.max(-180, bbox[0]),
          lamax: Math.min(90, bbox[3]),
          lomax: Math.min(180, bbox[2]),
        })
      : OPENSKY_STATES;

    try {
      const raw = await fetchUpstream<{ time: number; states: StateVector[] | null }>(url, {
        provider: 'OpenSky Network',
        revalidate: 12,
        retries: 1,
        timeoutMs: 15_000,
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });

      const flights = (raw.states ?? [])
        .map((state) => {
          const lng = state[S.Longitude];
          const lat = state[S.Latitude];
          if (typeof lng !== 'number' || typeof lat !== 'number') return null;
          const onGround = Boolean(state[S.OnGround]);
          const baroAltitude = numberOrNull(state[S.BaroAltitude]);
          const verticalRate = numberOrNull(state[S.VerticalRate]);
          const velocityMs = numberOrNull(state[S.Velocity]);
          return {
            icao24: String(state[S.Icao24] ?? '').trim(),
            callsign: typeof state[S.Callsign] === 'string' ? state[S.Callsign].trim() || null : null,
            originCountry: String(state[S.OriginCountry] ?? 'Unknown'),
            position: { lng, lat },
            altitude: baroAltitude,
            geoAltitude: numberOrNull(state[S.GeoAltitude]),
            velocity: velocityMs === null ? null : +(velocityMs * 3.6).toFixed(1),
            heading: numberOrNull(state[S.TrueTrack]),
            verticalRate,
            onGround,
            phase: derivePhase(onGround, verticalRate, baroAltitude),
            squawk: typeof state[S.Squawk] === 'string' ? state[S.Squawk] : null,
            spi: Boolean(state[S.Spi]),
            lastContact: new Date((numberOrNull(state[S.LastContact]) ?? raw.time) * 1000).toISOString(),
          } satisfies FlightState;
        })
        .filter((f): f is FlightState => f !== null && f.icao24.length > 0);

      return {
        flights,
        total: flights.length,
        bbox,
        attribution: 'OpenSky Network',
        fetchedAt: new Date(raw.time * 1000).toISOString(),
      } satisfies FlightFeed;
    } catch {
      // OpenSky aggressively rate limits anonymous callers; surface an empty feed
      // with attribution instead of failing the whole dashboard.
      return {
        flights: [],
        total: 0,
        bbox,
        attribution: 'OpenSky Network (temporarily unavailable)',
        fetchedAt: new Date().toISOString(),
      } satisfies FlightFeed;
    }
  });

  const filtered = bbox ? feed.flights.filter((f) => bboxContains(bbox, f.position)) : feed.flights;
  return { ...feed, flights: filtered.slice(0, limit), total: filtered.length };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Major airports. Bundled rather than fetched: the list is stable, small, and
 * needs to be available for offline/air-gapped deployments.
 */
export const MAJOR_AIRPORTS: readonly Airport[] = [
  { iata: 'ATL', icao: 'KATL', name: 'Hartsfield–Jackson Atlanta', city: 'Atlanta', countryCode: 'US', location: { lng: -84.4277, lat: 33.6407 }, elevationM: 313, timezone: 'America/New_York', passengers: 104_653_000 },
  { iata: 'DXB', icao: 'OMDB', name: 'Dubai International', city: 'Dubai', countryCode: 'AE', location: { lng: 55.3644, lat: 25.2532 }, elevationM: 19, timezone: 'Asia/Dubai', passengers: 86_994_000 },
  { iata: 'DFW', icao: 'KDFW', name: 'Dallas/Fort Worth', city: 'Dallas', countryCode: 'US', location: { lng: -97.038, lat: 32.8998 }, elevationM: 185, timezone: 'America/Chicago', passengers: 81_762_000 },
  { iata: 'HND', icao: 'RJTT', name: 'Tokyo Haneda', city: 'Tokyo', countryCode: 'JP', location: { lng: 139.7798, lat: 35.5494 }, elevationM: 6, timezone: 'Asia/Tokyo', passengers: 78_700_000 },
  { iata: 'LHR', icao: 'EGLL', name: 'London Heathrow', city: 'London', countryCode: 'GB', location: { lng: -0.4543, lat: 51.4706 }, elevationM: 25, timezone: 'Europe/London', passengers: 79_200_000 },
  { iata: 'DEN', icao: 'KDEN', name: 'Denver International', city: 'Denver', countryCode: 'US', location: { lng: -104.6737, lat: 39.8561 }, elevationM: 1655, timezone: 'America/Denver', passengers: 77_800_000 },
  { iata: 'IST', icao: 'LTFM', name: 'Istanbul Airport', city: 'Istanbul', countryCode: 'TR', location: { lng: 28.7519, lat: 41.2753 }, elevationM: 99, timezone: 'Europe/Istanbul', passengers: 76_000_000 },
  { iata: 'LAX', icao: 'KLAX', name: 'Los Angeles International', city: 'Los Angeles', countryCode: 'US', location: { lng: -118.4085, lat: 33.9416 }, elevationM: 38, timezone: 'America/Los_Angeles', passengers: 75_050_000 },
  { iata: 'ORD', icao: 'KORD', name: "Chicago O'Hare", city: 'Chicago', countryCode: 'US', location: { lng: -87.9048, lat: 41.9786 }, elevationM: 204, timezone: 'America/Chicago', passengers: 73_890_000 },
  { iata: 'CDG', icao: 'LFPG', name: 'Paris Charles de Gaulle', city: 'Paris', countryCode: 'FR', location: { lng: 2.5479, lat: 49.0097 }, elevationM: 119, timezone: 'Europe/Paris', passengers: 67_400_000 },
  { iata: 'DEL', icao: 'VIDP', name: 'Indira Gandhi International', city: 'Delhi', countryCode: 'IN', location: { lng: 77.1, lat: 28.5562 }, elevationM: 237, timezone: 'Asia/Kolkata', passengers: 72_200_000 },
  { iata: 'AMS', icao: 'EHAM', name: 'Amsterdam Schiphol', city: 'Amsterdam', countryCode: 'NL', location: { lng: 4.7639, lat: 52.3086 }, elevationM: -3, timezone: 'Europe/Amsterdam', passengers: 61_900_000 },
  { iata: 'SIN', icao: 'WSSS', name: 'Singapore Changi', city: 'Singapore', countryCode: 'SG', location: { lng: 103.9915, lat: 1.3644 }, elevationM: 7, timezone: 'Asia/Singapore', passengers: 58_900_000 },
  { iata: 'CAN', icao: 'ZGGG', name: 'Guangzhou Baiyun', city: 'Guangzhou', countryCode: 'CN', location: { lng: 113.2988, lat: 23.3924 }, elevationM: 15, timezone: 'Asia/Shanghai', passengers: 63_100_000 },
  { iata: 'PVG', icao: 'ZSPD', name: 'Shanghai Pudong', city: 'Shanghai', countryCode: 'CN', location: { lng: 121.8053, lat: 31.1443 }, elevationM: 4, timezone: 'Asia/Shanghai', passengers: 54_400_000 },
  { iata: 'FRA', icao: 'EDDF', name: 'Frankfurt am Main', city: 'Frankfurt', countryCode: 'DE', location: { lng: 8.5622, lat: 50.0379 }, elevationM: 111, timezone: 'Europe/Berlin', passengers: 59_400_000 },
  { iata: 'JFK', icao: 'KJFK', name: 'New York John F. Kennedy', city: 'New York', countryCode: 'US', location: { lng: -73.7781, lat: 40.6413 }, elevationM: 4, timezone: 'America/New_York', passengers: 62_500_000 },
  { iata: 'MAD', icao: 'LEMD', name: 'Adolfo Suárez Madrid–Barajas', city: 'Madrid', countryCode: 'ES', location: { lng: -3.5676, lat: 40.4719 }, elevationM: 610, timezone: 'Europe/Madrid', passengers: 60_200_000 },
  { iata: 'BCN', icao: 'LEBL', name: 'Josep Tarradellas Barcelona–El Prat', city: 'Barcelona', countryCode: 'ES', location: { lng: 2.0785, lat: 41.2974 }, elevationM: 4, timezone: 'Europe/Madrid', passengers: 49_900_000 },
  { iata: 'ICN', icao: 'RKSI', name: 'Seoul Incheon', city: 'Seoul', countryCode: 'KR', location: { lng: 126.4407, lat: 37.4602 }, elevationM: 7, timezone: 'Asia/Seoul', passengers: 56_100_000 },
  { iata: 'MEX', icao: 'MMMX', name: 'Mexico City Benito Juárez', city: 'Mexico City', countryCode: 'MX', location: { lng: -99.0721, lat: 19.4363 }, elevationM: 2230, timezone: 'America/Mexico_City', passengers: 45_400_000 },
  { iata: 'GRU', icao: 'SBGR', name: 'São Paulo–Guarulhos', city: 'São Paulo', countryCode: 'BR', location: { lng: -46.4731, lat: -23.4356 }, elevationM: 750, timezone: 'America/Sao_Paulo', passengers: 41_600_000 },
  { iata: 'SYD', icao: 'YSSY', name: 'Sydney Kingsford Smith', city: 'Sydney', countryCode: 'AU', location: { lng: 151.1772, lat: -33.9399 }, elevationM: 6, timezone: 'Australia/Sydney', passengers: 38_400_000 },
  { iata: 'JNB', icao: 'FAOR', name: 'O. R. Tambo International', city: 'Johannesburg', countryCode: 'ZA', location: { lng: 28.2426, lat: -26.1367 }, elevationM: 1694, timezone: 'Africa/Johannesburg', passengers: 21_200_000 },
  { iata: 'CAI', icao: 'HECA', name: 'Cairo International', city: 'Cairo', countryCode: 'EG', location: { lng: 31.4056, lat: 30.1219 }, elevationM: 116, timezone: 'Africa/Cairo', passengers: 26_300_000 },
  { iata: 'DOH', icao: 'OTHH', name: 'Hamad International', city: 'Doha', countryCode: 'QA', location: { lng: 51.6081, lat: 25.2731 }, elevationM: 4, timezone: 'Asia/Qatar', passengers: 52_700_000 },
  { iata: 'BOM', icao: 'VABB', name: 'Chhatrapati Shivaji Maharaj', city: 'Mumbai', countryCode: 'IN', location: { lng: 72.8679, lat: 19.0896 }, elevationM: 11, timezone: 'Asia/Kolkata', passengers: 52_800_000 },
  { iata: 'YYZ', icao: 'CYYZ', name: 'Toronto Pearson', city: 'Toronto', countryCode: 'CA', location: { lng: -79.6306, lat: 43.6777 }, elevationM: 173, timezone: 'America/Toronto', passengers: 44_800_000 },
  { iata: 'SVO', icao: 'UUEE', name: 'Moscow Sheremetyevo', city: 'Moscow', countryCode: 'RU', location: { lng: 37.4146, lat: 55.9726 }, elevationM: 190, timezone: 'Europe/Moscow', passengers: 43_400_000 },
  { iata: 'BKK', icao: 'VTBS', name: 'Suvarnabhumi', city: 'Bangkok', countryCode: 'TH', location: { lng: 100.7501, lat: 13.6811 }, elevationM: 2, timezone: 'Asia/Bangkok', passengers: 51_800_000 },
] as const;

export function findNearestAirports(point: { lng: number; lat: number }, count = 5): Airport[] {
  return [...MAJOR_AIRPORTS]
    .map((airport) => ({
      airport,
      distance:
        (airport.location.lat - point.lat) ** 2 +
        ((airport.location.lng - point.lng) * Math.cos((point.lat * Math.PI) / 180)) ** 2,
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count)
    .map((entry) => entry.airport);
}
