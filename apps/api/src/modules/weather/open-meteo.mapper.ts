import {
  aqiBand,
  compositeAqi,
  describeWeatherCode,
  type AirQualityBundle,
  type AirQualityHourly,
  type ClimateNormal,
  type ClimateTrendPoint,
  type LngLat,
  type PollenForecast,
  type WeatherBundle,
  type WeatherDaily,
  type WeatherHourly,
} from '@edt/shared';

export interface RawOpenMeteo {
  latitude?: number;
  longitude?: number;
  timezone?: string;
  elevation?: number;
  current?: Record<string, number | string>;
  hourly?: Record<string, (number | string | null)[]>;
  daily?: Record<string, (number | string | null)[]>;
}

export const FORECAST_CURRENT_FIELDS = [
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
].join(',');

export const FORECAST_HOURLY_FIELDS = [
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
].join(',');

export const FORECAST_DAILY_FIELDS = [
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
].join(',');

export const AIR_QUALITY_CURRENT_FIELDS = [
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
].join(',');

export const AIR_QUALITY_HOURLY_FIELDS = [
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
].join(',');

export function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function optionalNum(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function times(series: Record<string, (number | string | null)[]> | undefined): string[] {
  const values = series?.time;
  return Array.isArray(values) ? values.map((entry) => String(entry)) : [];
}

function firstFinite(values?: (number | string | null)[]): number | undefined {
  for (const value of values ?? []) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function mapHourly(hourly?: Record<string, (number | string | null)[]>): WeatherHourly[] {
  return times(hourly).map((time, index) => {
    const code = num(hourly?.weather_code?.[index], 3);
    return {
      time,
      temperature: num(hourly?.temperature_2m?.[index]),
      apparentTemperature: num(hourly?.apparent_temperature?.[index]),
      precipitation: num(hourly?.precipitation?.[index]),
      precipitationProbability: num(hourly?.precipitation_probability?.[index]),
      humidity: num(hourly?.relative_humidity_2m?.[index]),
      windSpeed: num(hourly?.wind_speed_10m?.[index]),
      windDirection: num(hourly?.wind_direction_10m?.[index]),
      cloudCover: num(hourly?.cloud_cover?.[index]),
      pressure: num(hourly?.pressure_msl?.[index]),
      uvIndex: num(hourly?.uv_index?.[index]),
      condition: describeWeatherCode(code).condition,
      code,
      isDay: num(hourly?.is_day?.[index], 1) === 1,
    };
  });
}

export function mapDaily(daily?: Record<string, (number | string | null)[]>): WeatherDaily[] {
  return times(daily).map((date, index) => {
    const code = num(daily?.weather_code?.[index], 3);
    return {
      date,
      temperatureMax: num(daily?.temperature_2m_max?.[index]),
      temperatureMin: num(daily?.temperature_2m_min?.[index]),
      precipitationSum: num(daily?.precipitation_sum?.[index]),
      precipitationProbability: num(daily?.precipitation_probability_max?.[index]),
      windSpeedMax: num(daily?.wind_speed_10m_max?.[index]),
      windGustMax: num(daily?.wind_gusts_10m_max?.[index]),
      uvIndexMax: num(daily?.uv_index_max?.[index]),
      sunrise: String(daily?.sunrise?.[index] ?? ''),
      sunset: String(daily?.sunset?.[index] ?? ''),
      daylight: num(daily?.daylight_duration?.[index]),
      condition: describeWeatherCode(code).condition,
      code,
    };
  });
}

export function mapWeatherBundle(
  raw: RawOpenMeteo,
  point: LngLat,
  attribution: string,
): WeatherBundle {
  const current = raw.current ?? {};
  const code = num(current.weather_code, 3);
  return {
    location: { lng: raw.longitude ?? point.lng, lat: raw.latitude ?? point.lat },
    timezone: raw.timezone ?? 'UTC',
    elevation: num(raw.elevation),
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
      isDay: num(current.is_day, 1) === 1,
      condition: describeWeatherCode(code).condition,
      code,
      observedAt: new Date().toISOString(),
    },
    hourly: mapHourly(raw.hourly),
    daily: mapDaily(raw.daily),
    alerts: [],
    attribution,
    fetchedAt: new Date().toISOString(),
  };
}

export function mapAirQualityBundle(
  raw: RawOpenMeteo,
  point: LngLat,
  attribution: string,
): AirQualityBundle {
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
  const reportedUsAqi = optionalNum(current.us_aqi);
  const aqi = reportedUsAqi && reportedUsAqi > 0 ? Math.round(reportedUsAqi) : composite.aqi;

  const hourly: AirQualityHourly[] = times(raw.hourly).map((time, index) => ({
    time,
    aqi: Math.round(num(raw.hourly?.us_aqi?.[index])),
    pm25: num(raw.hourly?.pm2_5?.[index]),
    pm10: num(raw.hourly?.pm10?.[index]),
    no2: num(raw.hourly?.nitrogen_dioxide?.[index]),
    o3: num(raw.hourly?.ozone?.[index]),
  }));

  const pollen: PollenForecast[] = times(raw.hourly).map((time, index) => ({
    time,
    alder: optionalNum(raw.hourly?.alder_pollen?.[index]),
    birch: optionalNum(raw.hourly?.birch_pollen?.[index]),
    grass: optionalNum(raw.hourly?.grass_pollen?.[index]),
    mugwort: optionalNum(raw.hourly?.mugwort_pollen?.[index]),
    olive: optionalNum(raw.hourly?.olive_pollen?.[index]),
    ragweed: optionalNum(raw.hourly?.ragweed_pollen?.[index]),
  }));

  return {
    location: { lng: raw.longitude ?? point.lng, lat: raw.latitude ?? point.lat },
    timezone: raw.timezone ?? 'UTC',
    now: {
      aqi,
      band: aqiBand(aqi).band,
      dominantPollutant: composite.dominant,
      ...concentrations,
      europeanAqi: optionalNum(current.european_aqi),
      dust: optionalNum(current.dust),
      aerosolOpticalDepth: optionalNum(current.aerosol_optical_depth),
      observedAt: new Date().toISOString(),
    },
    hourly,
    pollen: pollen.some((entry) => entry.grass !== undefined || entry.birch !== undefined)
      ? pollen
      : undefined,
    attribution,
    fetchedAt: new Date().toISOString(),
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(2));
}

function pushFinite(target: number[], value: unknown): void {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) target.push(parsed);
}

export function aggregateMonthlyNormals(raw: RawOpenMeteo): ClimateNormal[] {
  const dates = times(raw.daily);
  const buckets = new Map<
    number,
    { mean: number[]; max: number[]; min: number[]; precipitation: number[] }
  >();
  dates.forEach((date, index) => {
    const month = Number(date.slice(5, 7));
    const bucket = buckets.get(month) ?? { mean: [], max: [], min: [], precipitation: [] };
    pushFinite(bucket.mean, raw.daily?.temperature_2m_mean?.[index]);
    pushFinite(bucket.max, raw.daily?.temperature_2m_max?.[index]);
    pushFinite(bucket.min, raw.daily?.temperature_2m_min?.[index]);
    pushFinite(bucket.precipitation, raw.daily?.precipitation_sum?.[index]);
    buckets.set(month, bucket);
  });
  const years = new Set(dates.map((date) => date.slice(0, 4))).size || 30;

  return Array.from({ length: 12 }, (_, index) => {
    const bucket = buckets.get(index + 1);
    const precipitation = bucket?.precipitation ?? [];
    return {
      month: index + 1,
      temperatureMean: average(bucket?.mean ?? []),
      temperatureMax: average(bucket?.max ?? []),
      temperatureMin: average(bucket?.min ?? []),
      precipitation: Number(
        (precipitation.reduce((total, value) => total + value, 0) / years).toFixed(1),
      ),
    };
  });
}

export function aggregateAnnualTrend(raw: RawOpenMeteo): ClimateTrendPoint[] {
  const dates = times(raw.daily);
  const buckets = new Map<number, { mean: number[]; precipitation: number[] }>();
  dates.forEach((date, index) => {
    const year = Number(date.slice(0, 4));
    const bucket = buckets.get(year) ?? { mean: [], precipitation: [] };
    pushFinite(bucket.mean, raw.daily?.temperature_2m_mean?.[index]);
    pushFinite(bucket.precipitation, raw.daily?.precipitation_sum?.[index]);
    buckets.set(year, bucket);
  });

  return [...buckets.entries()]
    .filter(([, bucket]) => bucket.mean.length > 300)
    .sort(([a], [b]) => a - b)
    .map(([year, bucket]) => ({
      year,
      temperatureMean: average(bucket.mean),
      anomaly: 0,
      precipitation: Number(
        bucket.precipitation.reduce((total, value) => total + value, 0).toFixed(0),
      ),
    }));
}

/** Ordinary least squares slope, used for the warming-per-decade figure. */
export function linearSlope(points: { x: number; y: number }[]): number {
  if (points.length < 2) return 0;
  const n = points.length;
  const sumX = points.reduce((total, point) => total + point.x, 0);
  const sumY = points.reduce((total, point) => total + point.y, 0);
  const sumXY = points.reduce((total, point) => total + point.x * point.y, 0);
  const sumXX = points.reduce((total, point) => total + point.x * point.x, 0);
  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return 0;
  return (n * sumXY - sumX * sumY) / denominator;
}

/** Simplified Köppen-Geiger classification from monthly normals. */
export function classifyKoppen(
  normals: ClimateNormal[],
  latitude: number,
): { code: string; label: string } {
  if (normals.length !== 12) return { code: '—', label: 'Unclassified' };
  const temperatures = normals.map((normal) => normal.temperatureMean);
  const precipitation = normals.map((normal) => normal.precipitation);
  const annualTemperature = average(temperatures);
  const annualPrecipitation = precipitation.reduce((total, value) => total + value, 0);
  const coldest = Math.min(...temperatures);
  const warmest = Math.max(...temperatures);
  const summerMonths = latitude >= 0 ? [3, 4, 5, 6, 7, 8] : [9, 10, 11, 0, 1, 2];
  const summerPrecipitation = summerMonths.reduce(
    (total, month) => total + (precipitation[month] ?? 0),
    0,
  );
  const winterPrecipitation = annualPrecipitation - summerPrecipitation;
  const share = annualPrecipitation === 0 ? 0 : summerPrecipitation / annualPrecipitation;
  const winterShare = annualPrecipitation === 0 ? 0 : winterPrecipitation / annualPrecipitation;
  const aridityThreshold =
    20 * annualTemperature + (share > 0.7 ? 280 : winterShare > 0.7 ? 0 : 140);

  if (warmest < 10)
    return coldest < -3 ? { code: 'EF', label: 'Ice cap' } : { code: 'ET', label: 'Tundra' };
  if (annualPrecipitation < aridityThreshold) {
    const code = annualPrecipitation < aridityThreshold / 2 ? 'BW' : 'BS';
    const heat = annualTemperature >= 18 ? 'h' : 'k';
    return {
      code: `${code}${heat}`,
      label: `${code === 'BW' ? 'Desert' : 'Steppe'} — ${heat === 'h' ? 'hot' : 'cold'}`,
    };
  }
  if (coldest >= 18) {
    const driest = Math.min(...precipitation);
    if (driest >= 60) return { code: 'Af', label: 'Tropical rainforest' };
    if (driest >= 100 - annualPrecipitation / 25) return { code: 'Am', label: 'Tropical monsoon' };
    return { code: 'Aw', label: 'Tropical savanna' };
  }
  if (coldest > -3) {
    const summerDry = Math.min(...summerMonths.map((month) => precipitation[month] ?? 0)) < 30;
    if (summerDry) return { code: 'Csa', label: 'Mediterranean' };
    return warmest >= 22
      ? { code: 'Cfa', label: 'Humid subtropical' }
      : { code: 'Cfb', label: 'Oceanic' };
  }
  return warmest >= 22
    ? { code: 'Dfa', label: 'Hot-summer continental' }
    : { code: 'Dfb', label: 'Warm-summer continental' };
}
