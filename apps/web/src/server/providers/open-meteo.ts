import {
  aqiBand,
  compositeAqi,
  describeWeatherCode,
  type AirQualityBundle,
  type AirQualityHourly,
  type ClimateBundle,
  type ClimateNormal,
  type ClimateTrendPoint,
  type LngLat,
  type Place,
  type PollenForecast,
  type WeatherBundle,
  type WeatherDaily,
  type WeatherHourly,
} from '@edt/shared';
import { buildUrl, fetchUpstream } from '../http';
import { cached, cacheKey } from '../cache';
import { linearRegression } from '@/lib/utils';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const CLIMATE_URL = 'https://climate-api.open-meteo.com/v1/climate';
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';
const ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation';

export const OPEN_METEO_ATTRIBUTION = 'Open-Meteo · ECMWF IFS · NOAA GFS · Copernicus CAMS';

interface RawForecast {
  latitude: number;
  longitude: number;
  timezone: string;
  elevation: number;
  current?: Record<string, number>;
  hourly?: Record<string, (number | string)[]>;
  daily?: Record<string, (number | string)[]>;
}

/** Current conditions + 168 h hourly + 16 d daily in a single upstream call. */
export async function getWeather(point: LngLat, timezone = 'auto'): Promise<WeatherBundle> {
  const key = cacheKey('open-meteo:weather', {
    lat: round(point.lat),
    lng: round(point.lng),
    timezone,
  });
  return cached(key, 600, async () => {
    const url = buildUrl(FORECAST_URL, {
      latitude: point.lat,
      longitude: point.lng,
      timezone,
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'is_day',
        'precipitation',
        'weather_code',
        'cloud_cover',
        'pressure_msl',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
        'visibility',
      ].join(','),
      hourly: [
        'temperature_2m',
        'apparent_temperature',
        'precipitation',
        'precipitation_probability',
        'relative_humidity_2m',
        'wind_speed_10m',
        'wind_direction_10m',
        'cloud_cover',
        'pressure_msl',
        'uv_index',
        'weather_code',
        'is_day',
      ].join(','),
      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_sum',
        'precipitation_probability_max',
        'wind_speed_10m_max',
        'wind_gusts_10m_max',
        'uv_index_max',
        'sunrise',
        'sunset',
        'daylight_duration',
      ].join(','),
      forecast_days: 16,
      past_days: 2,
      wind_speed_unit: 'kmh',
    });

    const raw = await fetchUpstream<RawForecast>(url, { provider: 'Open-Meteo', revalidate: 600 });
    const current = raw.current ?? {};
    const code = Number(current.weather_code ?? 3);
    const described = describeWeatherCode(code);

    return {
      location: { lng: raw.longitude, lat: raw.latitude },
      timezone: raw.timezone,
      elevation: raw.elevation,
      now: {
        temperature: num(current.temperature_2m),
        apparentTemperature: num(current.apparent_temperature),
        humidity: num(current.relative_humidity_2m),
        pressure: num(current.pressure_msl),
        windSpeed: num(current.wind_speed_10m),
        windGust: num(current.wind_gusts_10m),
        windDirection: num(current.wind_direction_10m),
        cloudCover: num(current.cloud_cover),
        precipitation: num(current.precipitation),
        visibility: num(current.visibility, 10_000),
        uvIndex: firstFinite(raw.hourly?.uv_index) ?? 0,
        isDay: Number(current.is_day ?? 1) === 1,
        condition: described.condition,
        code,
        observedAt: new Date().toISOString(),
      },
      hourly: mapHourly(raw.hourly),
      daily: mapDaily(raw.daily),
      alerts: [],
      attribution: OPEN_METEO_ATTRIBUTION,
      fetchedAt: new Date().toISOString(),
    };
  });
}

function mapHourly(hourly?: Record<string, (number | string)[]>): WeatherHourly[] {
  if (!hourly?.time) return [];
  const times = hourly.time as string[];
  return times.map((time, i) => {
    const code = Number(hourly.weather_code?.[i] ?? 3);
    return {
      time,
      temperature: num(hourly.temperature_2m?.[i]),
      apparentTemperature: num(hourly.apparent_temperature?.[i]),
      precipitation: num(hourly.precipitation?.[i]),
      precipitationProbability: num(hourly.precipitation_probability?.[i]),
      humidity: num(hourly.relative_humidity_2m?.[i]),
      windSpeed: num(hourly.wind_speed_10m?.[i]),
      windDirection: num(hourly.wind_direction_10m?.[i]),
      cloudCover: num(hourly.cloud_cover?.[i]),
      pressure: num(hourly.pressure_msl?.[i]),
      uvIndex: num(hourly.uv_index?.[i]),
      condition: describeWeatherCode(code).condition,
      code,
      isDay: Number(hourly.is_day?.[i] ?? 1) === 1,
    };
  });
}

function mapDaily(daily?: Record<string, (number | string)[]>): WeatherDaily[] {
  if (!daily?.time) return [];
  const dates = daily.time as string[];
  return dates.map((date, i) => {
    const code = Number(daily.weather_code?.[i] ?? 3);
    return {
      date,
      temperatureMax: num(daily.temperature_2m_max?.[i]),
      temperatureMin: num(daily.temperature_2m_min?.[i]),
      precipitationSum: num(daily.precipitation_sum?.[i]),
      precipitationProbability: num(daily.precipitation_probability_max?.[i]),
      windSpeedMax: num(daily.wind_speed_10m_max?.[i]),
      windGustMax: num(daily.wind_gusts_10m_max?.[i]),
      uvIndexMax: num(daily.uv_index_max?.[i]),
      sunrise: String(daily.sunrise?.[i] ?? ''),
      sunset: String(daily.sunset?.[i] ?? ''),
      daylight: num(daily.daylight_duration?.[i]),
      condition: describeWeatherCode(code).condition,
      code,
    };
  });
}

/** CAMS air quality with EPA AQI recomputed from raw concentrations. */
export async function getAirQuality(point: LngLat, timezone = 'auto'): Promise<AirQualityBundle> {
  const key = cacheKey('open-meteo:aqi', { lat: round(point.lat), lng: round(point.lng) });
  return cached(key, 1800, async () => {
    const url = buildUrl(AIR_QUALITY_URL, {
      latitude: point.lat,
      longitude: point.lng,
      timezone,
      current: [
        'pm10',
        'pm2_5',
        'carbon_monoxide',
        'nitrogen_dioxide',
        'sulphur_dioxide',
        'ozone',
        'dust',
        'aerosol_optical_depth',
        'european_aqi',
        'us_aqi',
      ].join(','),
      hourly: [
        'pm10',
        'pm2_5',
        'nitrogen_dioxide',
        'ozone',
        'us_aqi',
        'alder_pollen',
        'birch_pollen',
        'grass_pollen',
        'mugwort_pollen',
        'olive_pollen',
        'ragweed_pollen',
      ].join(','),
      forecast_days: 5,
      past_days: 1,
    });

    const raw = await fetchUpstream<RawForecast>(url, {
      provider: 'Open-Meteo AQ',
      revalidate: 1800,
    });
    const current = raw.current ?? {};
    const concentrations = {
      pm25: num(current.pm2_5),
      pm10: num(current.pm10),
      no2: num(current.nitrogen_dioxide),
      so2: num(current.sulphur_dioxide),
      o3: num(current.ozone),
      co: num(current.carbon_monoxide),
    };
    const composite = compositeAqi(concentrations);
    const usAqi = Number(current.us_aqi);
    const aqi = Number.isFinite(usAqi) && usAqi > 0 ? Math.round(usAqi) : composite.aqi;

    const hourly: AirQualityHourly[] =
      (raw.hourly?.time as string[] | undefined)?.map((time, i) => ({
        time,
        aqi: Math.round(num(raw.hourly?.us_aqi?.[i])),
        pm25: num(raw.hourly?.pm2_5?.[i]),
        pm10: num(raw.hourly?.pm10?.[i]),
        no2: num(raw.hourly?.nitrogen_dioxide?.[i]),
        o3: num(raw.hourly?.ozone?.[i]),
      })) ?? [];

    const pollen: PollenForecast[] =
      (raw.hourly?.time as string[] | undefined)?.map((time, i) => ({
        time,
        alder: optional(raw.hourly?.alder_pollen?.[i]),
        birch: optional(raw.hourly?.birch_pollen?.[i]),
        grass: optional(raw.hourly?.grass_pollen?.[i]),
        mugwort: optional(raw.hourly?.mugwort_pollen?.[i]),
        olive: optional(raw.hourly?.olive_pollen?.[i]),
        ragweed: optional(raw.hourly?.ragweed_pollen?.[i]),
      })) ?? [];

    return {
      location: { lng: raw.longitude, lat: raw.latitude },
      timezone: raw.timezone,
      now: {
        aqi,
        band: aqiBand(aqi).band,
        dominantPollutant: composite.dominant,
        ...concentrations,
        europeanAqi: optional(current.european_aqi),
        dust: optional(current.dust),
        aerosolOpticalDepth: optional(current.aerosol_optical_depth),
        observedAt: new Date().toISOString(),
      },
      hourly,
      pollen: pollen.some((p) => p.grass !== undefined || p.birch !== undefined)
        ? pollen
        : undefined,
      attribution: 'Copernicus CAMS via Open-Meteo',
      fetchedAt: new Date().toISOString(),
    };
  });
}

/**
 * Climate context: 1991-2020 monthly normals from the ERA5 archive plus an
 * annual mean-temperature series back to 1950 for the warming trend.
 */
export async function getClimate(point: LngLat): Promise<ClimateBundle> {
  const key = cacheKey('open-meteo:climate', {
    lat: round(point.lat, 1),
    lng: round(point.lng, 1),
  });
  return cached(key, 86_400, async () => {
    const normalsUrl = buildUrl(ARCHIVE_URL, {
      latitude: point.lat,
      longitude: point.lng,
      start_date: '1991-01-01',
      end_date: '2020-12-31',
      daily: [
        'temperature_2m_mean',
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_sum',
      ].join(','),
      timezone: 'UTC',
    });
    const trendUrl = buildUrl(ARCHIVE_URL, {
      latitude: point.lat,
      longitude: point.lng,
      start_date: '1950-01-01',
      end_date: `${new Date().getUTCFullYear() - 1}-12-31`,
      daily: ['temperature_2m_mean', 'precipitation_sum'].join(','),
      timezone: 'UTC',
    });

    const [normalsRaw, trendRaw] = await Promise.all([
      fetchUpstream<RawForecast>(normalsUrl, {
        provider: 'Open-Meteo Archive',
        revalidate: 86_400,
      }),
      fetchUpstream<RawForecast>(trendUrl, { provider: 'Open-Meteo Archive', revalidate: 86_400 }),
    ]);

    const normals = aggregateMonthlyNormals(normalsRaw);
    const trend = aggregateAnnualTrend(trendRaw);
    const baseline =
      trend
        .filter((p) => p.year >= 1951 && p.year <= 1980)
        .reduce((a, p) => a + p.temperatureMean, 0) /
      Math.max(1, trend.filter((p) => p.year >= 1951 && p.year <= 1980).length);
    const withAnomaly = trend.map((p) => ({
      ...p,
      anomaly: +(p.temperatureMean - baseline).toFixed(3),
    }));
    const { slope } = linearRegression(
      withAnomaly.map((p) => ({ x: p.year, y: p.temperatureMean })),
    );
    const koppen = classifyKoppen(normals, point.lat);

    return {
      location: point,
      normals,
      trend: withAnomaly,
      koppenClass: koppen.code,
      koppenLabel: koppen.label,
      warmingPerDecade: +(slope * 10).toFixed(3),
      attribution: 'ERA5 reanalysis via Open-Meteo',
      fetchedAt: new Date().toISOString(),
    };
  });
}

function aggregateMonthlyNormals(raw: RawForecast): ClimateNormal[] {
  const times = (raw.daily?.time as string[] | undefined) ?? [];
  const buckets = new Map<
    number,
    { mean: number[]; max: number[]; min: number[]; precip: number[] }
  >();
  times.forEach((date, i) => {
    const month = Number(date.slice(5, 7));
    const bucket = buckets.get(month) ?? { mean: [], max: [], min: [], precip: [] };
    pushFinite(bucket.mean, raw.daily?.temperature_2m_mean?.[i]);
    pushFinite(bucket.max, raw.daily?.temperature_2m_max?.[i]);
    pushFinite(bucket.min, raw.daily?.temperature_2m_min?.[i]);
    pushFinite(bucket.precip, raw.daily?.precipitation_sum?.[i]);
    buckets.set(month, bucket);
  });
  const years = new Set(times.map((t) => t.slice(0, 4))).size || 30;
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const bucket = buckets.get(month);
    return {
      month,
      temperatureMean: avg(bucket?.mean ?? []),
      temperatureMax: avg(bucket?.max ?? []),
      temperatureMin: avg(bucket?.min ?? []),
      precipitation: +((bucket?.precip ?? []).reduce((a, b) => a + b, 0) / years).toFixed(1),
    };
  });
}

function aggregateAnnualTrend(raw: RawForecast): ClimateTrendPoint[] {
  const times = (raw.daily?.time as string[] | undefined) ?? [];
  const buckets = new Map<number, { mean: number[]; precip: number[] }>();
  times.forEach((date, i) => {
    const year = Number(date.slice(0, 4));
    const bucket = buckets.get(year) ?? { mean: [], precip: [] };
    pushFinite(bucket.mean, raw.daily?.temperature_2m_mean?.[i]);
    pushFinite(bucket.precip, raw.daily?.precipitation_sum?.[i]);
    buckets.set(year, bucket);
  });
  return Array.from(buckets.entries())
    .filter(([, b]) => b.mean.length > 300)
    .sort(([a], [b]) => a - b)
    .map(([year, b]) => ({
      year,
      temperatureMean: avg(b.mean),
      anomaly: 0,
      precipitation: +b.precip.reduce((a, c) => a + c, 0).toFixed(0),
    }));
}

/** Simplified Köppen-Geiger classification from monthly normals. */
function classifyKoppen(
  normals: ClimateNormal[],
  latitude: number,
): { code: string; label: string } {
  if (normals.length !== 12) return { code: '—', label: 'Unclassified' };
  const temps = normals.map((n) => n.temperatureMean);
  const precip = normals.map((n) => n.precipitation);
  const annualTemp = avg(temps);
  const annualPrecip = precip.reduce((a, b) => a + b, 0);
  const coldest = Math.min(...temps);
  const warmest = Math.max(...temps);
  const northern = latitude >= 0;
  const summerMonths = northern ? [3, 4, 5, 6, 7, 8] : [9, 10, 11, 0, 1, 2];
  const summerPrecip = summerMonths.reduce((a, m) => a + (precip[m] ?? 0), 0);
  const winterPrecip = annualPrecip - summerPrecip;
  const aridityThreshold =
    20 * annualTemp +
    (summerPrecip / annualPrecip > 0.7 ? 280 : winterPrecip / annualPrecip > 0.7 ? 0 : 140);

  if (warmest < 10) {
    return coldest < -3 ? { code: 'EF', label: 'Ice cap' } : { code: 'ET', label: 'Tundra' };
  }
  if (annualPrecip < aridityThreshold) {
    const code = annualPrecip < aridityThreshold / 2 ? 'BW' : 'BS';
    const heat = annualTemp >= 18 ? 'h' : 'k';
    return {
      code: code + heat,
      label: `${code === 'BW' ? 'Desert' : 'Steppe'} — ${heat === 'h' ? 'hot' : 'cold'}`,
    };
  }
  if (coldest >= 18) {
    const driest = Math.min(...precip);
    if (driest >= 60) return { code: 'Af', label: 'Tropical rainforest' };
    if (driest >= 100 - annualPrecip / 25) return { code: 'Am', label: 'Tropical monsoon' };
    return { code: 'Aw', label: 'Tropical savanna' };
  }
  if (coldest > -3) {
    const summerDry = Math.min(...summerMonths.map((m) => precip[m] ?? 0)) < 30;
    if (summerDry) return { code: 'Csa', label: 'Mediterranean' };
    return warmest >= 22
      ? { code: 'Cfa', label: 'Humid subtropical' }
      : { code: 'Cfb', label: 'Oceanic' };
  }
  return warmest >= 22
    ? { code: 'Dfa', label: 'Hot-summer continental' }
    : { code: 'Dfb', label: 'Warm-summer continental' };
}

interface RawGeocode {
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
    admin2?: string;
    timezone?: string;
    population?: number;
  }[];
}

const FEATURE_KIND: Record<string, Place['kind']> = {
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

/** Global gazetteer search across 40k+ populated places. */
export async function geocode(query: string, limit = 12, language = 'en'): Promise<Place[]> {
  const key = cacheKey('open-meteo:geocode', { query: query.toLowerCase(), limit, language });
  return cached(key, 3600, async () => {
    const url = buildUrl(GEOCODE_URL, { name: query, count: limit, language, format: 'json' });
    const raw = await fetchUpstream<RawGeocode>(url, {
      provider: 'Open-Meteo Geocoding',
      revalidate: 3600,
    });
    return (raw.results ?? []).map((r) => {
      const hierarchy = [r.name, r.admin1, r.country].filter(Boolean).join(', ');
      return {
        id: `geoname:${r.id}`,
        name: r.name,
        label: hierarchy,
        kind: FEATURE_KIND[r.feature_code ?? ''] ?? 'other',
        countryCode: r.country_code,
        admin1: r.admin1,
        population: r.population,
        timezone: r.timezone,
        center: { lng: r.longitude, lat: r.latitude },
      } satisfies Place;
    });
  });
}

/** Reverse geocode by finding the nearest populated place. */
export async function reverseGeocode(point: LngLat): Promise<Place | null> {
  const key = cacheKey('open-meteo:reverse', {
    lat: round(point.lat, 2),
    lng: round(point.lng, 2),
  });
  return cached(key, 3600, async () => {
    // Open-Meteo has no reverse endpoint; BigDataCloud's free tier is key-less.
    const url = buildUrl('https://api.bigdatacloud.net/data/reverse-geocode-client', {
      latitude: point.lat,
      longitude: point.lng,
      localityLanguage: 'en',
    });
    try {
      const raw = await fetchUpstream<{
        city?: string;
        locality?: string;
        principalSubdivision?: string;
        countryName?: string;
        countryCode?: string;
      }>(url, { provider: 'BigDataCloud', revalidate: 3600, retries: 1 });
      const name = raw.city || raw.locality || raw.principalSubdivision || raw.countryName;
      if (!name) return null;
      return {
        id: `rev:${round(point.lat, 3)},${round(point.lng, 3)}`,
        name,
        label: [name, raw.principalSubdivision, raw.countryName].filter(Boolean).join(', '),
        kind: raw.city || raw.locality ? 'city' : 'region',
        countryCode: raw.countryCode,
        admin1: raw.principalSubdivision,
        center: point,
      } satisfies Place;
    } catch {
      return null;
    }
  });
}

export async function getElevation(points: LngLat[]): Promise<number[]> {
  if (points.length === 0) return [];
  const url = buildUrl(ELEVATION_URL, {
    latitude: points.map((p) => p.lat).join(','),
    longitude: points.map((p) => p.lng).join(','),
  });
  const raw = await fetchUpstream<{ elevation: number[] }>(url, {
    provider: 'Open-Meteo Elevation',
    revalidate: 86_400,
  });
  return raw.elevation ?? [];
}

export interface MarineConditions {
  location: LngLat;
  waveHeight: number | null;
  wavePeriod: number | null;
  waveDirection: number | null;
  swellHeight: number | null;
  seaSurfaceTemperature: number | null;
  hourly: { time: string; waveHeight: number; sst: number }[];
  attribution: string;
}

export async function getMarine(point: LngLat): Promise<MarineConditions | null> {
  const key = cacheKey('open-meteo:marine', { lat: round(point.lat), lng: round(point.lng) });
  return cached(key, 10_800, async () => {
    const url = buildUrl(MARINE_URL, {
      latitude: point.lat,
      longitude: point.lng,
      current: [
        'wave_height',
        'wave_period',
        'wave_direction',
        'swell_wave_height',
        'sea_surface_temperature',
      ].join(','),
      hourly: ['wave_height', 'sea_surface_temperature'].join(','),
      forecast_days: 5,
    });
    try {
      const raw = await fetchUpstream<RawForecast>(url, {
        provider: 'Open-Meteo Marine',
        revalidate: 10_800,
        retries: 1,
      });
      const current = raw.current ?? {};
      const times = (raw.hourly?.time as string[] | undefined) ?? [];
      return {
        location: point,
        waveHeight: optional(current.wave_height) ?? null,
        wavePeriod: optional(current.wave_period) ?? null,
        waveDirection: optional(current.wave_direction) ?? null,
        swellHeight: optional(current.swell_wave_height) ?? null,
        seaSurfaceTemperature: optional(current.sea_surface_temperature) ?? null,
        hourly: times.map((time, i) => ({
          time,
          waveHeight: num(raw.hourly?.wave_height?.[i]),
          sst: num(raw.hourly?.sea_surface_temperature?.[i]),
        })),
        attribution: 'Open-Meteo Marine · ECMWF WAM',
      };
    } catch {
      // Inland coordinates legitimately have no marine grid cell.
      return null;
    }
  });
}

/** Sample a coarse grid of a scalar field for heatmap/contour rendering. */
export async function sampleWeatherGrid(
  variable:
    | 'temperature_2m'
    | 'wind_speed_10m'
    | 'relative_humidity_2m'
    | 'pressure_msl'
    | 'cloud_cover',
  bbox: [number, number, number, number],
  resolution = 6,
): Promise<{ lng: number; lat: number; value: number }[]> {
  const [west, south, east, north] = bbox;
  const points: LngLat[] = [];
  const lngStep = (east - west) / (resolution - 1 || 1);
  const latStep = (north - south) / (resolution - 1 || 1);
  for (let i = 0; i < resolution; i += 1) {
    for (let j = 0; j < resolution; j += 1) {
      points.push({ lng: west + i * lngStep, lat: south + j * latStep });
    }
  }
  const key = cacheKey('open-meteo:grid', {
    variable,
    bbox: bbox.map((n) => round(n, 1)).join(','),
    resolution,
  });
  return cached(key, 1800, async () => {
    const url = buildUrl(FORECAST_URL, {
      latitude: points.map((p) => round(p.lat, 3)).join(','),
      longitude: points.map((p) => round(p.lng, 3)).join(','),
      current: variable,
      wind_speed_unit: 'kmh',
    });
    const raw = await fetchUpstream<RawForecast | RawForecast[]>(url, {
      provider: 'Open-Meteo Grid',
      revalidate: 1800,
    });
    const list = Array.isArray(raw) ? raw : [raw];
    return list
      .map((entry, index) => ({
        lng: entry.longitude ?? points[index]?.lng ?? 0,
        lat: entry.latitude ?? points[index]?.lat ?? 0,
        value: num(entry.current?.[variable]),
      }))
      .filter((p) => Number.isFinite(p.value));
  });
}

// ── helpers ──────────────────────────────────────────────────────────────────

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optional(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function firstFinite(values?: (number | string)[]): number | undefined {
  if (!values) return undefined;
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function pushFinite(target: number[], value: unknown): void {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) target.push(parsed);
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
