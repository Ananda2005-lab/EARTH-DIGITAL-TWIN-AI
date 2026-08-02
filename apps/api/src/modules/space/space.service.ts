import { Injectable } from '@nestjs/common';
import type { LngLat } from '@edt/shared';
import { UPSTREAM_URLS } from 'src/infra/upstream/providers';
import { UpstreamService } from 'src/infra/upstream/upstream.service';

export interface IssPosition {
  position: LngLat;
  altitudeKm: number;
  velocityKmh: number;
  visibility: string;
  observedAt: string;
  attribution: string;
}

export interface SpaceWeather {
  kpIndex: number;
  kpBand: 'quiet' | 'unsettled' | 'active' | 'storm' | 'severe';
  solarWindSpeed: number | null;
  solarWindDensity: number | null;
  bz: number | null;
  solarFlux107: number | null;
  sunspotNumber: number | null;
  auroraVisibleAboveLatitude: number | null;
  observedAt: string;
  attribution: string;
}

export interface SatelliteGroup {
  id: string;
  label: string;
  count: number;
}

export interface TleRecord {
  name: string;
  line1: string;
  line2: string;
}

const SATELLITE_GROUPS: { id: string; label: string }[] = [
  { id: 'stations', label: 'Space stations' },
  { id: 'starlink', label: 'Starlink' },
  { id: 'gps-ops', label: 'GPS operational' },
  { id: 'galileo', label: 'Galileo' },
  { id: 'weather', label: 'Weather satellites' },
  { id: 'science', label: 'Science missions' },
];

function kpBand(kp: number): SpaceWeather['kpBand'] {
  if (kp >= 8) return 'severe';
  if (kp >= 6) return 'storm';
  if (kp >= 5) return 'active';
  if (kp >= 4) return 'unsettled';
  return 'quiet';
}

/** Equatorward edge of the auroral oval for a given Kp (rule of thumb). */
function auroraLatitude(kp: number): number {
  return Math.max(40, 67 - kp * 2.5);
}

/**
 * Space weather, ISS telemetry and the satellite TLE catalogue. Every provider
 * is optional; the payload reports whatever is currently reachable.
 */
@Injectable()
export class SpaceService {
  constructor(private readonly upstream: UpstreamService) {}

  async issPosition(): Promise<IssPosition> {
    const result = await this.upstream.json<{
      latitude: number;
      longitude: number;
      altitude: number;
      velocity: number;
      visibility: string;
      timestamp: number;
    }>({ provider: 'issTracker', url: UPSTREAM_URLS.issPosition, ttl: 8, retries: 1 });

    return {
      position: { lng: result.data.longitude, lat: result.data.latitude },
      altitudeKm: Number(result.data.altitude.toFixed(1)),
      velocityKmh: Number(result.data.velocity.toFixed(0)),
      visibility: result.data.visibility,
      observedAt: new Date(result.data.timestamp * 1000).toISOString(),
      attribution: result.attribution,
    };
  }

  /** Ground track sampled backwards and forwards from now. */
  async issTrack(minutes = 90, samples = 30): Promise<LngLat[]> {
    const now = Math.floor(Date.now() / 1000);
    const step = Math.max(1, Math.floor((minutes * 60) / samples));
    const timestamps = Array.from({ length: samples }, (_, index) => now + index * step);

    const result = await this.upstream.safeJson<{ latitude: number; longitude: number }[]>(
      {
        provider: 'issTracker',
        url: `${UPSTREAM_URLS.issPosition}/positions`,
        query: { timestamps: timestamps.join(','), units: 'kilometers' },
        ttl: 60,
        retries: 1,
      },
      [],
    );
    return result.data.map((entry) => ({ lng: entry.longitude, lat: entry.latitude }));
  }

  async spaceWeather(): Promise<SpaceWeather> {
    const [kp, plasma, magnetics, flux] = await Promise.all([
      this.upstream.safeJson<string[][]>(
        { provider: 'noaaSwpc', url: UPSTREAM_URLS.swpcKpIndex, retries: 1 },
        [],
      ),
      this.upstream.safeJson<string[][]>(
        { provider: 'noaaSwpc', url: UPSTREAM_URLS.swpcPlasma, retries: 1 },
        [],
      ),
      this.upstream.safeJson<string[][]>(
        { provider: 'noaaSwpc', url: UPSTREAM_URLS.swpcMagnetics, retries: 1 },
        [],
      ),
      this.upstream.safeJson<{ flux: number; ssn: number; time_tag: string }[]>(
        { provider: 'noaaSwpc', url: UPSTREAM_URLS.swpcSolarFlux, retries: 1 },
        [],
      ),
    ]);

    const kpValue = lastNumeric(kp.data, 1) ?? 0;
    const plasmaRow = lastRow(plasma.data);
    const magneticsRow = lastRow(magnetics.data);
    const fluxRow = flux.data[flux.data.length - 1];

    return {
      kpIndex: Number(kpValue.toFixed(2)),
      kpBand: kpBand(kpValue),
      solarWindDensity: numberAt(plasmaRow, 1),
      solarWindSpeed: numberAt(plasmaRow, 2),
      bz: numberAt(magneticsRow, 3),
      solarFlux107: fluxRow ? Number(fluxRow.flux) : null,
      sunspotNumber: fluxRow ? Number(fluxRow.ssn) : null,
      auroraVisibleAboveLatitude: Number(auroraLatitude(kpValue).toFixed(1)),
      observedAt: new Date().toISOString(),
      attribution: kp.attribution,
    };
  }

  async satelliteGroups(): Promise<SatelliteGroup[]> {
    const counts = await Promise.all(
      SATELLITE_GROUPS.map(async (group) => {
        const records = await this.tle(group.id);
        return { ...group, count: records.length };
      }),
    );
    return counts;
  }

  /** Two-line element sets for a CelesTrak group, parsed into records. */
  async tle(group: string): Promise<TleRecord[]> {
    const result = await this.upstream.safeText({
      provider: 'celestrak',
      url: UPSTREAM_URLS.celestrakGroup,
      query: { GROUP: group, FORMAT: 'tle' },
      retries: 1,
      cacheKey: group,
    });

    const lines = result.data
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const records: TleRecord[] = [];
    for (let index = 0; index + 2 < lines.length + 1; index += 3) {
      const name = lines[index];
      const line1 = lines[index + 1];
      const line2 = lines[index + 2];
      if (!name || !line1?.startsWith('1 ') || !line2?.startsWith('2 ')) continue;
      records.push({ name, line1, line2 });
    }
    return records;
  }
}

function lastRow(rows: string[][]): string[] | undefined {
  return rows.length > 1 ? rows[rows.length - 1] : undefined;
}

function lastNumeric(rows: string[][], column: number): number | null {
  for (let index = rows.length - 1; index > 0; index -= 1) {
    const value = Number(rows[index]?.[column]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function numberAt(row: string[] | undefined, column: number): number | null {
  const value = Number(row?.[column]);
  return Number.isFinite(value) ? value : null;
}
