import { Injectable } from '@nestjs/common';
import type { AirQualityBundle, ClimateBundle, LngLat, WeatherBundle } from '@edt/shared';
import { UPSTREAM_URLS } from 'src/infra/upstream/providers';
import { UpstreamService } from 'src/infra/upstream/upstream.service';
import {
  AIR_QUALITY_CURRENT_FIELDS,
  AIR_QUALITY_HOURLY_FIELDS,
  FORECAST_CURRENT_FIELDS,
  FORECAST_DAILY_FIELDS,
  FORECAST_HOURLY_FIELDS,
  aggregateAnnualTrend,
  aggregateMonthlyNormals,
  classifyKoppen,
  linearSlope,
  mapAirQualityBundle,
  mapWeatherBundle,
  num,
  optionalNum,
  type RawOpenMeteo,
} from './open-meteo.mapper';

export interface MarineConditions {
  location: LngLat;
  waveHeight: number | null;
  wavePeriod: number | null;
  waveDirection: number | null;
  swellHeight: number | null;
  seaSurfaceTemperature: number | null;
  hourly: { time: string; waveHeight: number; seaSurfaceTemperature: number }[];
  attribution: string;
}

export interface GridSample {
  lng: number;
  lat: number;
  value: number;
}

export type GridVariable =
  | 'temperature_2m'
  | 'wind_speed_10m'
  | 'relative_humidity_2m'
  | 'pressure_msl'
  | 'cloud_cover';

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Weather, air quality, climate and marine conditions, all sourced from
 * Open-Meteo through the shared upstream client (cache + breaker + retries).
 */
@Injectable()
export class WeatherService {
  constructor(private readonly upstream: UpstreamService) {}

  async forecast(point: LngLat, timezone = 'auto'): Promise<WeatherBundle> {
    const result = await this.upstream.json<RawOpenMeteo>({
      provider: 'openMeteoForecast',
      url: UPSTREAM_URLS.openMeteoForecast,
      query: {
        latitude: round(point.lat, 3),
        longitude: round(point.lng, 3),
        timezone,
        current: FORECAST_CURRENT_FIELDS,
        hourly: FORECAST_HOURLY_FIELDS,
        daily: FORECAST_DAILY_FIELDS,
        forecast_days: 16,
        past_days: 2,
        wind_speed_unit: 'kmh',
      },
    });
    return mapWeatherBundle(result.data, point, result.attribution);
  }

  async airQuality(point: LngLat, timezone = 'auto'): Promise<AirQualityBundle> {
    const result = await this.upstream.json<RawOpenMeteo>({
      provider: 'openMeteoAirQuality',
      url: UPSTREAM_URLS.openMeteoAirQuality,
      query: {
        latitude: round(point.lat, 2),
        longitude: round(point.lng, 2),
        timezone,
        current: AIR_QUALITY_CURRENT_FIELDS,
        hourly: AIR_QUALITY_HOURLY_FIELDS,
        forecast_days: 5,
        past_days: 1,
      },
    });
    return mapAirQualityBundle(result.data, point, result.attribution);
  }

  /** 1991-2020 monthly normals plus the annual mean series back to 1950. */
  async climate(point: LngLat): Promise<ClimateBundle> {
    const lastFullYear = new Date().getUTCFullYear() - 1;
    const [normalsResult, trendResult] = await Promise.all([
      this.upstream.json<RawOpenMeteo>({
        provider: 'openMeteoArchive',
        url: UPSTREAM_URLS.openMeteoArchive,
        cacheKey: 'normals',
        query: {
          latitude: round(point.lat, 1),
          longitude: round(point.lng, 1),
          start_date: '1991-01-01',
          end_date: '2020-12-31',
          daily: 'temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum',
          timezone: 'UTC',
        },
      }),
      this.upstream.json<RawOpenMeteo>({
        provider: 'openMeteoArchive',
        url: UPSTREAM_URLS.openMeteoArchive,
        cacheKey: 'trend',
        query: {
          latitude: round(point.lat, 1),
          longitude: round(point.lng, 1),
          start_date: '1950-01-01',
          end_date: `${lastFullYear}-12-31`,
          daily: 'temperature_2m_mean,precipitation_sum',
          timezone: 'UTC',
        },
      }),
    ]);

    const normals = aggregateMonthlyNormals(normalsResult.data);
    const trend = aggregateAnnualTrend(trendResult.data);
    const baselineYears = trend.filter((point_) => point_.year >= 1951 && point_.year <= 1980);
    const baseline =
      baselineYears.length > 0
        ? baselineYears.reduce((total, entry) => total + entry.temperatureMean, 0) /
          baselineYears.length
        : 0;
    const withAnomaly = trend.map((entry) => ({
      ...entry,
      anomaly: Number((entry.temperatureMean - baseline).toFixed(3)),
    }));
    const slope = linearSlope(
      withAnomaly.map((entry) => ({ x: entry.year, y: entry.temperatureMean })),
    );
    const koppen = classifyKoppen(normals, point.lat);

    return {
      location: point,
      normals,
      trend: withAnomaly,
      koppenClass: koppen.code,
      koppenLabel: koppen.label,
      warmingPerDecade: Number((slope * 10).toFixed(3)),
      attribution: normalsResult.attribution,
      fetchedAt: new Date().toISOString(),
    };
  }

  /** Marine conditions, or `null` for inland coordinates with no grid cell. */
  async marine(point: LngLat): Promise<MarineConditions | null> {
    const result = await this.upstream.safeJson<RawOpenMeteo | null>(
      {
        provider: 'openMeteoMarine',
        url: UPSTREAM_URLS.openMeteoMarine,
        retries: 1,
        query: {
          latitude: round(point.lat, 2),
          longitude: round(point.lng, 2),
          current:
            'wave_height,wave_period,wave_direction,swell_wave_height,sea_surface_temperature',
          hourly: 'wave_height,sea_surface_temperature',
          forecast_days: 5,
        },
      },
      null,
    );
    const raw = result.data;
    if (!raw) return null;

    const current = raw.current ?? {};
    const timeSeries = Array.isArray(raw.hourly?.time)
      ? raw.hourly.time.map((value) => String(value))
      : [];

    return {
      location: point,
      waveHeight: optionalNum(current.wave_height) ?? null,
      wavePeriod: optionalNum(current.wave_period) ?? null,
      waveDirection: optionalNum(current.wave_direction) ?? null,
      swellHeight: optionalNum(current.swell_wave_height) ?? null,
      seaSurfaceTemperature: optionalNum(current.sea_surface_temperature) ?? null,
      hourly: timeSeries.map((time, index) => ({
        time,
        waveHeight: num(raw.hourly?.wave_height?.[index]),
        seaSurfaceTemperature: num(raw.hourly?.sea_surface_temperature?.[index]),
      })),
      attribution: result.attribution,
    };
  }

  /** Coarse scalar field sample used by the globe's heatmap layers. */
  async grid(
    variable: GridVariable,
    bbox: [number, number, number, number],
    resolution = 6,
  ): Promise<GridSample[]> {
    const [west, south, east, north] = bbox;
    const steps = Math.max(2, Math.min(12, resolution));
    const lngStep = (east - west) / (steps - 1);
    const latStep = (north - south) / (steps - 1);
    const points: LngLat[] = [];
    for (let i = 0; i < steps; i += 1) {
      for (let j = 0; j < steps; j += 1) {
        points.push({ lng: west + i * lngStep, lat: south + j * latStep });
      }
    }

    const result = await this.upstream.safeJson<RawOpenMeteo | RawOpenMeteo[]>(
      {
        provider: 'openMeteoForecast',
        url: UPSTREAM_URLS.openMeteoForecast,
        cacheKey: `grid:${variable}:${bbox.map((value) => round(value, 1)).join(',')}:${steps}`,
        ttl: 1800,
        query: {
          latitude: points.map((point) => round(point.lat, 3)).join(','),
          longitude: points.map((point) => round(point.lng, 3)).join(','),
          current: variable,
          wind_speed_unit: 'kmh',
        },
      },
      [],
    );

    const entries = Array.isArray(result.data) ? result.data : [result.data];
    return entries
      .map((entry, index) => ({
        lng: entry.longitude ?? points[index]?.lng ?? 0,
        lat: entry.latitude ?? points[index]?.lat ?? 0,
        value: num(entry.current?.[variable]),
      }))
      .filter((sample) => Number.isFinite(sample.value));
  }

  async elevation(points: LngLat[]): Promise<number[]> {
    if (points.length === 0) return [];
    const result = await this.upstream.safeJson<{ elevation?: number[] }>(
      {
        provider: 'openMeteoElevation',
        url: UPSTREAM_URLS.openMeteoElevation,
        query: {
          latitude: points.map((point) => round(point.lat, 4)).join(','),
          longitude: points.map((point) => round(point.lng, 4)).join(','),
        },
      },
      {},
    );
    return result.data.elevation ?? [];
  }
}
