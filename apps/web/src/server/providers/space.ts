import type { LngLat } from '@edt/shared';
import { fetchUpstream } from '../http';
import { cached, cacheKey } from '../cache';

export interface IssState {
  position: LngLat;
  altitudeKm: number;
  velocityKmh: number;
  visibility: string;
  footprintKm: number;
  solarLat: number;
  solarLng: number;
  timestamp: string;
}

/** Live ISS state vector. */
export async function getIssState(): Promise<IssState | null> {
  return cached('iss:now', 8, async () => {
    try {
      const raw = await fetchUpstream<{
        latitude: number;
        longitude: number;
        altitude: number;
        velocity: number;
        visibility: string;
        footprint: number;
        solar_lat: number;
        solar_lon: number;
        timestamp: number;
      }>('https://api.wheretheiss.at/v1/satellites/25544', {
        provider: 'WhereTheISS.at',
        revalidate: 8,
        retries: 1,
      });
      return {
        position: { lng: raw.longitude, lat: raw.latitude },
        altitudeKm: raw.altitude,
        velocityKmh: raw.velocity,
        visibility: raw.visibility,
        footprintKm: raw.footprint,
        solarLat: raw.solar_lat,
        solarLng: raw.solar_lon,
        timestamp: new Date(raw.timestamp * 1000).toISOString(),
      };
    } catch {
      return null;
    }
  });
}

/** Predicted ISS ground track for the next `minutes`, sampled every 30 s. */
export async function getIssTrack(
  minutes = 90,
): Promise<{ position: LngLat; timestamp: string }[]> {
  const key = cacheKey('iss:track', { minutes, bucket: Math.floor(Date.now() / 60_000) });
  return cached(key, 60, async () => {
    const now = Math.floor(Date.now() / 1000);
    const steps = Math.min(70, Math.floor((minutes * 60) / 60));
    const timestamps = Array.from({ length: steps }, (_, i) => now + i * 60);
    try {
      const raw = await fetchUpstream<{ latitude: number; longitude: number; timestamp: number }[]>(
        `https://api.wheretheiss.at/v1/satellites/25544/positions?timestamps=${timestamps.join(',')}&units=kilometers`,
        { provider: 'WhereTheISS.at', revalidate: 60, retries: 1 },
      );
      return raw.map((p) => ({
        position: { lng: p.longitude, lat: p.latitude },
        timestamp: new Date(p.timestamp * 1000).toISOString(),
      }));
    } catch {
      return [];
    }
  });
}

export interface SpaceWeather {
  kpIndex: number;
  kpBand:
    | 'quiet'
    | 'unsettled'
    | 'active'
    | 'minor_storm'
    | 'moderate_storm'
    | 'strong_storm'
    | 'severe_storm';
  auroraVisibleAboveLat: number;
  solarWindSpeed: number | null;
  solarWindDensity: number | null;
  bz: number | null;
  radioFlux: number | null;
  sunspotNumber: number | null;
  observedAt: string;
  series: { time: string; kp: number }[];
  attribution: string;
}

function kpBand(kp: number): SpaceWeather['kpBand'] {
  if (kp >= 8) return 'severe_storm';
  if (kp >= 7) return 'strong_storm';
  if (kp >= 6) return 'moderate_storm';
  if (kp >= 5) return 'minor_storm';
  if (kp >= 4) return 'active';
  if (kp >= 3) return 'unsettled';
  return 'quiet';
}

/** Kp index geomagnetic latitude threshold for naked-eye aurora. */
function auroraLatitude(kp: number): number {
  const table = [66.5, 64.5, 62.4, 60.4, 58.3, 56.3, 54.2, 52.2, 50.1, 48];
  const index = Math.min(9, Math.max(0, Math.round(kp)));
  return table[index] ?? 66.5;
}

/** NOAA SWPC planetary K index plus solar wind conditions. */
export async function getSpaceWeather(): Promise<SpaceWeather> {
  return cached('swpc:conditions', 900, async () => {
    const [kpRaw, plasmaRaw, magRaw, fluxRaw] = await Promise.all([
      fetchUpstream<[string, string, string, string][]>(
        'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json',
        { provider: 'NOAA SWPC', revalidate: 900, retries: 1 },
      ).catch(() => [] as [string, string, string, string][]),
      fetchUpstream<string[][]>(
        'https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json',
        {
          provider: 'NOAA SWPC',
          revalidate: 900,
          retries: 1,
        },
      ).catch(() => [] as string[][]),
      fetchUpstream<string[][]>(
        'https://services.swpc.noaa.gov/products/solar-wind/mag-1-day.json',
        {
          provider: 'NOAA SWPC',
          revalidate: 900,
          retries: 1,
        },
      ).catch(() => [] as string[][]),
      fetchUpstream<{ flux: number; ssn: number; time_tag: string }[]>(
        'https://services.swpc.noaa.gov/json/f107_cm_flux.json',
        { provider: 'NOAA SWPC', revalidate: 3600, retries: 1 },
      ).catch(() => [] as { flux: number; ssn: number; time_tag: string }[]),
    ]);

    const kpRows = kpRaw.slice(1).filter((row) => row.length >= 2);
    const series = kpRows.slice(-96).map((row) => ({
      time: `${row[0]!.replace(' ', 'T')}Z`,
      kp: Number(row[1]) || 0,
    }));
    const kpIndex = series.length > 0 ? (series[series.length - 1]!.kp ?? 0) : 0;

    const plasmaRows = plasmaRaw.slice(1).filter((row) => row.length >= 3);
    const lastPlasma = plasmaRows[plasmaRows.length - 1];
    const magRows = magRaw.slice(1).filter((row) => row.length >= 4);
    const lastMag = magRows[magRows.length - 1];
    const lastFlux = fluxRaw[fluxRaw.length - 1];

    return {
      kpIndex,
      kpBand: kpBand(kpIndex),
      auroraVisibleAboveLat: auroraLatitude(kpIndex),
      solarWindDensity: lastPlasma ? Number(lastPlasma[1]) || null : null,
      solarWindSpeed: lastPlasma ? Number(lastPlasma[2]) || null : null,
      bz: lastMag ? Number(lastMag[3]) || null : null,
      radioFlux: lastFlux?.flux ?? null,
      sunspotNumber: lastFlux?.ssn ?? null,
      observedAt: series[series.length - 1]?.time ?? new Date().toISOString(),
      series,
      attribution: 'NOAA Space Weather Prediction Center',
    } satisfies SpaceWeather;
  });
}

export interface SatelliteGroup {
  id: string;
  label: string;
  count: number;
  description: string;
}

/**
 * Catalogue overview from CelesTrak. Full SGP4 propagation happens client-side
 * for the visible subset; here we only summarise the constellations.
 */
export async function getSatelliteGroups(): Promise<SatelliteGroup[]> {
  return cached('celestrak:groups', 21_600, async () => {
    const groups: { id: string; label: string; description: string }[] = [
      { id: 'stations', label: 'Space stations', description: 'ISS, CSS and crewed vehicles' },
      { id: 'starlink', label: 'Starlink', description: 'SpaceX broadband constellation' },
      { id: 'oneweb', label: 'OneWeb', description: 'LEO broadband constellation' },
      { id: 'gps-ops', label: 'GPS', description: 'US navigation constellation' },
      { id: 'galileo', label: 'Galileo', description: 'EU navigation constellation' },
      { id: 'weather', label: 'Weather', description: 'Polar-orbiting meteorological satellites' },
      { id: 'geo', label: 'Geostationary', description: 'GEO communications and imaging' },
      {
        id: 'resource',
        label: 'Earth resources',
        description: 'Landsat, Sentinel and imaging platforms',
      },
    ];
    const counts = await Promise.all(
      groups.map(async (group) => {
        try {
          const text = await fetchUpstream<string>(
            `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group.id}&FORMAT=tle`,
            { provider: 'CelesTrak', revalidate: 21_600, retries: 1 },
          );
          const lines = String(text).trim().split(/\r?\n/).length;
          return Math.max(0, Math.floor(lines / 3));
        } catch {
          return 0;
        }
      }),
    );
    return groups.map((group, index) => ({ ...group, count: counts[index] ?? 0 }));
  });
}

/** Raw TLE set for a CelesTrak group, parsed into name + two element lines. */
export async function getTleSet(
  group: string,
  limit = 120,
): Promise<{ name: string; line1: string; line2: string }[]> {
  const key = cacheKey('celestrak:tle', { group, limit });
  return cached(key, 10_800, async () => {
    try {
      const text = await fetchUpstream<string>(
        `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(group)}&FORMAT=tle`,
        { provider: 'CelesTrak', revalidate: 10_800, retries: 1 },
      );
      const lines = String(text)
        .split(/\r?\n/)
        .map((line) => line.trimEnd())
        .filter((line) => line.length > 0);
      const out: { name: string; line1: string; line2: string }[] = [];
      for (let i = 0; i + 2 < lines.length + 1 && out.length < limit; i += 3) {
        const name = lines[i];
        const line1 = lines[i + 1];
        const line2 = lines[i + 2];
        if (!name || !line1 || !line2 || !line1.startsWith('1 ') || !line2.startsWith('2 '))
          continue;
        out.push({ name: name.trim(), line1, line2 });
      }
      return out;
    } catch {
      return [];
    }
  });
}
