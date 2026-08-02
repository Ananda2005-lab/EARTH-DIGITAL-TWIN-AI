import type { AqiBand, Pollutant, WeatherCondition } from '../types/weather';
import type { HazardKind, HazardSeverity } from '../types/hazard';
import type { UserRole } from '../types/user';

// ── Air quality ───────────────────────────────────────────────────────────────

export interface AqiBandDefinition {
  band: AqiBand;
  label: string;
  from: number;
  to: number;
  color: string;
  advice: string;
}

export const AQI_BANDS: readonly AqiBandDefinition[] = [
  {
    band: 'good',
    label: 'Good',
    from: 0,
    to: 50,
    color: '#22c55e',
    advice: 'Air quality is satisfactory and poses little or no risk.',
  },
  {
    band: 'moderate',
    label: 'Moderate',
    from: 51,
    to: 100,
    color: '#eab308',
    advice: 'Unusually sensitive people should consider limiting prolonged exertion outdoors.',
  },
  {
    band: 'unhealthy_sensitive',
    label: 'Unhealthy for sensitive groups',
    from: 101,
    to: 150,
    color: '#f97316',
    advice: 'People with heart or lung disease, older adults and children should reduce exertion.',
  },
  {
    band: 'unhealthy',
    label: 'Unhealthy',
    from: 151,
    to: 200,
    color: '#ef4444',
    advice: 'Everyone may begin to experience health effects; limit outdoor activity.',
  },
  {
    band: 'very_unhealthy',
    label: 'Very unhealthy',
    from: 201,
    to: 300,
    color: '#a21caf',
    advice: 'Health alert: the risk of health effects is increased for everyone.',
  },
  {
    band: 'hazardous',
    label: 'Hazardous',
    from: 301,
    to: 500,
    color: '#7f1d1d',
    advice: 'Emergency conditions. Everyone should avoid all outdoor exertion.',
  },
] as const;

export function aqiBand(aqi: number): AqiBandDefinition {
  const found = AQI_BANDS.find((b) => aqi >= b.from && aqi <= b.to);
  return found ?? AQI_BANDS[AQI_BANDS.length - 1]!;
}

export const POLLUTANT_LABEL: Record<Pollutant, string> = {
  pm25: 'PM2.5',
  pm10: 'PM10',
  no2: 'NO₂',
  so2: 'SO₂',
  o3: 'O₃',
  co: 'CO',
};

/** US EPA breakpoints (µg/m³ unless noted) used to convert concentrations to AQI. */
export const AQI_BREAKPOINTS: Record<Pollutant, { cLow: number; cHigh: number; iLow: number; iHigh: number }[]> = {
  pm25: [
    { cLow: 0, cHigh: 12, iLow: 0, iHigh: 50 },
    { cLow: 12.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
    { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
    { cLow: 55.5, cHigh: 150.4, iLow: 151, iHigh: 200 },
    { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300 },
    { cLow: 250.5, cHigh: 500.4, iLow: 301, iHigh: 500 },
  ],
  pm10: [
    { cLow: 0, cHigh: 54, iLow: 0, iHigh: 50 },
    { cLow: 55, cHigh: 154, iLow: 51, iHigh: 100 },
    { cLow: 155, cHigh: 254, iLow: 101, iHigh: 150 },
    { cLow: 255, cHigh: 354, iLow: 151, iHigh: 200 },
    { cLow: 355, cHigh: 424, iLow: 201, iHigh: 300 },
    { cLow: 425, cHigh: 604, iLow: 301, iHigh: 500 },
  ],
  o3: [
    { cLow: 0, cHigh: 108, iLow: 0, iHigh: 50 },
    { cLow: 109, cHigh: 140, iLow: 51, iHigh: 100 },
    { cLow: 141, cHigh: 170, iLow: 101, iHigh: 150 },
    { cLow: 171, cHigh: 210, iLow: 151, iHigh: 200 },
    { cLow: 211, cHigh: 400, iLow: 201, iHigh: 300 },
    { cLow: 401, cHigh: 800, iLow: 301, iHigh: 500 },
  ],
  no2: [
    { cLow: 0, cHigh: 100, iLow: 0, iHigh: 50 },
    { cLow: 101, cHigh: 188, iLow: 51, iHigh: 100 },
    { cLow: 189, cHigh: 677, iLow: 101, iHigh: 150 },
    { cLow: 678, cHigh: 1220, iLow: 151, iHigh: 200 },
    { cLow: 1221, cHigh: 2350, iLow: 201, iHigh: 300 },
    { cLow: 2351, cHigh: 3850, iLow: 301, iHigh: 500 },
  ],
  so2: [
    { cLow: 0, cHigh: 92, iLow: 0, iHigh: 50 },
    { cLow: 93, cHigh: 197, iLow: 51, iHigh: 100 },
    { cLow: 198, cHigh: 484, iLow: 101, iHigh: 150 },
    { cLow: 485, cHigh: 796, iLow: 151, iHigh: 200 },
    { cLow: 797, cHigh: 1583, iLow: 201, iHigh: 300 },
    { cLow: 1584, cHigh: 2630, iLow: 301, iHigh: 500 },
  ],
  co: [
    { cLow: 0, cHigh: 5000, iLow: 0, iHigh: 50 },
    { cLow: 5001, cHigh: 10_000, iLow: 51, iHigh: 100 },
    { cLow: 10_001, cHigh: 14_000, iLow: 101, iHigh: 150 },
    { cLow: 14_001, cHigh: 17_000, iLow: 151, iHigh: 200 },
    { cLow: 17_001, cHigh: 34_000, iLow: 201, iHigh: 300 },
    { cLow: 34_001, cHigh: 57_500, iLow: 301, iHigh: 500 },
  ],
};

// ── Hazards ───────────────────────────────────────────────────────────────────

export const HAZARD_SEVERITY_ORDER: readonly HazardSeverity[] = [
  'info',
  'low',
  'moderate',
  'high',
  'extreme',
];

export const HAZARD_SEVERITY_COLOR: Record<HazardSeverity, string> = {
  info: '#38bdf8',
  low: '#4ade80',
  moderate: '#facc15',
  high: '#f97316',
  extreme: '#ef4444',
};

export const HAZARD_META: Record<HazardKind, { label: string; icon: string; color: string; unit: string }> = {
  earthquake: { label: 'Earthquake', icon: 'Activity', color: '#f87171', unit: 'M' },
  wildfire: { label: 'Wildfire', icon: 'Flame', color: '#fb923c', unit: 'MW' },
  volcano: { label: 'Volcano', icon: 'Mountain', color: '#f43f5e', unit: 'alert' },
  flood: { label: 'Flood', icon: 'Waves', color: '#60a5fa', unit: 'alert' },
  cyclone: { label: 'Cyclone', icon: 'Tornado', color: '#22d3ee', unit: 'km/h' },
  drought: { label: 'Drought', icon: 'Sun', color: '#d97706', unit: 'index' },
  landslide: { label: 'Landslide', icon: 'MountainSnow', color: '#a3a380', unit: 'alert' },
  tsunami: { label: 'Tsunami', icon: 'Waves', color: '#818cf8', unit: 'm' },
};

// ── Weather ───────────────────────────────────────────────────────────────────

/** WMO 4677 weather interpretation codes used by Open-Meteo. */
export const WMO_CODES: Record<number, { condition: WeatherCondition; label: string; icon: string }> = {
  0: { condition: 'clear', label: 'Clear sky', icon: 'Sun' },
  1: { condition: 'mostly_clear', label: 'Mainly clear', icon: 'SunDim' },
  2: { condition: 'partly_cloudy', label: 'Partly cloudy', icon: 'CloudSun' },
  3: { condition: 'overcast', label: 'Overcast', icon: 'Cloudy' },
  45: { condition: 'fog', label: 'Fog', icon: 'CloudFog' },
  48: { condition: 'fog', label: 'Depositing rime fog', icon: 'CloudFog' },
  51: { condition: 'drizzle', label: 'Light drizzle', icon: 'CloudDrizzle' },
  53: { condition: 'drizzle', label: 'Moderate drizzle', icon: 'CloudDrizzle' },
  55: { condition: 'drizzle', label: 'Dense drizzle', icon: 'CloudDrizzle' },
  56: { condition: 'freezing_rain', label: 'Light freezing drizzle', icon: 'CloudHail' },
  57: { condition: 'freezing_rain', label: 'Dense freezing drizzle', icon: 'CloudHail' },
  61: { condition: 'rain', label: 'Slight rain', icon: 'CloudRain' },
  63: { condition: 'rain', label: 'Moderate rain', icon: 'CloudRain' },
  65: { condition: 'rain', label: 'Heavy rain', icon: 'CloudRainWind' },
  66: { condition: 'freezing_rain', label: 'Light freezing rain', icon: 'CloudHail' },
  67: { condition: 'freezing_rain', label: 'Heavy freezing rain', icon: 'CloudHail' },
  71: { condition: 'snow', label: 'Slight snowfall', icon: 'CloudSnow' },
  73: { condition: 'snow', label: 'Moderate snowfall', icon: 'CloudSnow' },
  75: { condition: 'snow', label: 'Heavy snowfall', icon: 'CloudSnow' },
  77: { condition: 'snow_grains', label: 'Snow grains', icon: 'CloudSnow' },
  80: { condition: 'showers', label: 'Slight rain showers', icon: 'CloudSunRain' },
  81: { condition: 'showers', label: 'Moderate rain showers', icon: 'CloudSunRain' },
  82: { condition: 'showers', label: 'Violent rain showers', icon: 'CloudRainWind' },
  85: { condition: 'snow_showers', label: 'Slight snow showers', icon: 'CloudSnow' },
  86: { condition: 'snow_showers', label: 'Heavy snow showers', icon: 'CloudSnow' },
  95: { condition: 'thunderstorm', label: 'Thunderstorm', icon: 'CloudLightning' },
  96: { condition: 'thunderstorm_hail', label: 'Thunderstorm with slight hail', icon: 'CloudLightning' },
  99: { condition: 'thunderstorm_hail', label: 'Thunderstorm with heavy hail', icon: 'CloudLightning' },
};

export function describeWeatherCode(code: number) {
  return WMO_CODES[code] ?? { condition: 'overcast' as WeatherCondition, label: 'Unknown', icon: 'Cloudy' };
}

/** Beaufort scale for wind descriptions. */
export const BEAUFORT: readonly { force: number; label: string; maxKmh: number }[] = [
  { force: 0, label: 'Calm', maxKmh: 1 },
  { force: 1, label: 'Light air', maxKmh: 5 },
  { force: 2, label: 'Light breeze', maxKmh: 11 },
  { force: 3, label: 'Gentle breeze', maxKmh: 19 },
  { force: 4, label: 'Moderate breeze', maxKmh: 28 },
  { force: 5, label: 'Fresh breeze', maxKmh: 38 },
  { force: 6, label: 'Strong breeze', maxKmh: 49 },
  { force: 7, label: 'Near gale', maxKmh: 61 },
  { force: 8, label: 'Gale', maxKmh: 74 },
  { force: 9, label: 'Strong gale', maxKmh: 88 },
  { force: 10, label: 'Storm', maxKmh: 102 },
  { force: 11, label: 'Violent storm', maxKmh: 117 },
  { force: 12, label: 'Hurricane', maxKmh: Number.POSITIVE_INFINITY },
] as const;

// ── Access control ────────────────────────────────────────────────────────────

export const ROLE_RANK: Record<UserRole, number> = {
  user: 0,
  analyst: 1,
  admin: 2,
  owner: 3,
};

export const PERMISSIONS = {
  'bookmark:write': ['user', 'analyst', 'admin', 'owner'],
  'report:generate': ['user', 'analyst', 'admin', 'owner'],
  'report:schedule': ['analyst', 'admin', 'owner'],
  'workspace:share': ['analyst', 'admin', 'owner'],
  'analytics:export': ['analyst', 'admin', 'owner'],
  'admin:read': ['admin', 'owner'],
  'admin:users': ['admin', 'owner'],
  'admin:content': ['admin', 'owner'],
  'admin:flags': ['admin', 'owner'],
  'admin:keys': ['owner'],
  'admin:system': ['owner'],
} as const satisfies Record<string, readonly UserRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly UserRole[]).includes(role);
}

export function atLeastRole(role: UserRole, required: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required];
}
