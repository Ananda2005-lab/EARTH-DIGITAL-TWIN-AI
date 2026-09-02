import type { LngLat } from './geo';

export type WeatherCondition =
  | 'clear'
  | 'mostly_clear'
  | 'partly_cloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'freezing_rain'
  | 'snow'
  | 'snow_grains'
  | 'showers'
  | 'snow_showers'
  | 'thunderstorm'
  | 'thunderstorm_hail';

export interface WeatherNow {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  /** Sea-level pressure in hPa. */
  pressure: number;
  /** Wind speed in km/h. */
  windSpeed: number;
  windGust: number;
  /** Meteorological wind direction in degrees (direction wind comes from). */
  windDirection: number;
  /** Total cloud cover 0..100. */
  cloudCover: number;
  /** Precipitation in the last hour, mm. */
  precipitation: number;
  /** Visibility in metres. */
  visibility: number;
  /** Dew point in °C when the provider supplies it. */
  dewPoint?: number;
  uvIndex: number;
  isDay: boolean;
  condition: WeatherCondition;
  code: number;
  observedAt: string;
}

export interface WeatherHourly {
  time: string;
  temperature: number;
  apparentTemperature: number;
  precipitation: number;
  precipitationProbability: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  cloudCover: number;
  pressure: number;
  uvIndex: number;
  condition: WeatherCondition;
  code: number;
  isDay: boolean;
}

export interface WeatherDaily {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
  precipitationSum: number;
  precipitationProbability: number;
  windSpeedMax: number;
  windGustMax: number;
  uvIndexMax: number;
  sunrise: string;
  sunset: string;
  /** Daylight duration in seconds. */
  daylight: number;
  condition: WeatherCondition;
  code: number;
}

export interface WeatherAlert {
  id: string;
  event: string;
  severity: 'minor' | 'moderate' | 'severe' | 'extreme';
  headline: string;
  description: string;
  effectiveFrom: string;
  effectiveTo: string;
  source: string;
}

export interface WeatherBundle {
  location: LngLat;
  timezone: string;
  elevation: number;
  now: WeatherNow;
  hourly: WeatherHourly[];
  daily: WeatherDaily[];
  alerts: WeatherAlert[];
  attribution: string;
  fetchedAt: string;
}

export type AqiBand =
  | 'good'
  | 'moderate'
  | 'unhealthy_sensitive'
  | 'unhealthy'
  | 'very_unhealthy'
  | 'hazardous';

export interface AirQualityNow {
  aqi: number;
  band: AqiBand;
  dominantPollutant: Pollutant;
  pm25: number;
  pm10: number;
  no2: number;
  so2: number;
  o3: number;
  co: number;
  /** European AQI as reported by CAMS. */
  europeanAqi?: number;
  dust?: number;
  aerosolOpticalDepth?: number;
  observedAt: string;
}

export type Pollutant = 'pm25' | 'pm10' | 'no2' | 'so2' | 'o3' | 'co';

export interface AirQualityHourly {
  time: string;
  aqi: number;
  pm25: number;
  pm10: number;
  no2: number;
  o3: number;
}

export interface AirQualityBundle {
  location: LngLat;
  timezone: string;
  now: AirQualityNow;
  hourly: AirQualityHourly[];
  pollen?: PollenForecast[];
  attribution: string;
  fetchedAt: string;
}

export interface PollenForecast {
  time: string;
  alder?: number;
  birch?: number;
  grass?: number;
  mugwort?: number;
  olive?: number;
  ragweed?: number;
}

export interface ClimateNormal {
  month: number;
  temperatureMean: number;
  temperatureMax: number;
  temperatureMin: number;
  precipitation: number;
}

export interface ClimateTrendPoint {
  year: number;
  temperatureMean: number;
  /** Anomaly against the 1951-1980 baseline, in Kelvin/Celsius degrees. */
  anomaly: number;
  precipitation: number;
}

export interface ClimateBundle {
  location: LngLat;
  normals: ClimateNormal[];
  trend: ClimateTrendPoint[];
  koppenClass?: string;
  koppenLabel?: string;
  /** Linear warming rate in degrees per decade over the trend window. */
  warmingPerDecade: number;
  attribution: string;
  fetchedAt: string;
}
