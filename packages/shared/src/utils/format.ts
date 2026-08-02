import { AQI_BREAKPOINTS, BEAUFORT } from '../constants/scales';
import type { Pollutant } from '../types/weather';

const compactFormatter = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return compactFormatter.format(value);
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

export function formatCurrency(value: number | null | undefined, currency = 'USD'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    notation: Math.abs(value) >= 1_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatTemperature(
  celsius: number | null | undefined,
  unit: 'celsius' | 'fahrenheit' = 'celsius',
): string {
  if (celsius === null || celsius === undefined || !Number.isFinite(celsius)) return '—';
  const value = unit === 'fahrenheit' ? celsius * (9 / 5) + 32 : celsius;
  return `${Math.round(value)}°${unit === 'fahrenheit' ? 'F' : 'C'}`;
}

export function formatDistance(
  metres: number | null | undefined,
  units: 'metric' | 'imperial' = 'metric',
): string {
  if (metres === null || metres === undefined || !Number.isFinite(metres)) return '—';
  if (units === 'imperial') {
    const feet = metres * 3.28084;
    if (feet < 1000) return `${Math.round(feet)} ft`;
    const miles = metres / 1609.344;
    return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
  }
  if (metres < 1000) return `${Math.round(metres)} m`;
  const km = metres / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${formatNumber(Math.round(km))} km`;
}

export function formatSpeed(
  kmh: number | null | undefined,
  units: 'metric' | 'imperial' = 'metric',
): string {
  if (kmh === null || kmh === undefined || !Number.isFinite(kmh)) return '—';
  return units === 'imperial' ? `${Math.round(kmh * 0.621371)} mph` : `${Math.round(kmh)} km/h`;
}

export function formatArea(
  km2: number | null | undefined,
  units: 'metric' | 'imperial' = 'metric',
): string {
  if (km2 === null || km2 === undefined || !Number.isFinite(km2)) return '—';
  return units === 'imperial'
    ? `${formatCompact(km2 * 0.386102)} mi²`
    : `${formatCompact(km2)} km²`;
}

export function formatCoordinates(lng: number, lat: number, digits = 4): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(digits)}°${ns}, ${Math.abs(lng).toFixed(digits)}°${ew}`;
}

export function formatDms(lng: number, lat: number): string {
  const convert = (value: number, positive: string, negative: string) => {
    const hemisphere = value >= 0 ? positive : negative;
    const abs = Math.abs(value);
    const degrees = Math.floor(abs);
    const minutesFloat = (abs - degrees) * 60;
    const minutes = Math.floor(minutesFloat);
    const seconds = ((minutesFloat - minutes) * 60).toFixed(1);
    return `${degrees}°${minutes}'${seconds}"${hemisphere}`;
  };
  return `${convert(lat, 'N', 'S')} ${convert(lng, 'E', 'W')}`;
}

export function formatBearing(degrees: number | null | undefined): string {
  if (degrees === null || degrees === undefined || !Number.isFinite(degrees)) return '—';
  const points = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ];
  const index = Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16;
  return `${points[index]} ${Math.round(degrees)}°`;
}

export function beaufortFor(kmh: number) {
  return BEAUFORT.find((b) => kmh <= b.maxKmh) ?? BEAUFORT[BEAUFORT.length - 1]!;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—';
  const abs = Math.abs(Math.round(seconds));
  const days = Math.floor(abs / 86_400);
  const hours = Math.floor((abs % 86_400) / 3600);
  const minutes = Math.floor((abs % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${abs % 60}s`;
  return `${abs}s`;
}

export function formatRelativeTime(input: string | number | Date, now = Date.now()): string {
  const timestamp = input instanceof Date ? input.getTime() : new Date(input).getTime();
  if (!Number.isFinite(timestamp)) return '—';
  const deltaSeconds = Math.round((timestamp - now) / 1000);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const divisions: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'],
    [3600, 'minute'],
    [86_400, 'hour'],
    [604_800, 'day'],
    [2_629_800, 'week'],
    [31_557_600, 'month'],
    [Number.POSITIVE_INFINITY, 'year'],
  ];
  let unitSeconds = 1;
  for (const [limit, unit] of divisions) {
    if (Math.abs(deltaSeconds) < limit) {
      return formatter.format(Math.round(deltaSeconds / unitSeconds), unit);
    }
    unitSeconds = limit;
  }
  return formatter.format(Math.round(deltaSeconds / 31_557_600), 'year');
}

export function formatClock(date: Date, timezone?: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(date);
}

export function formatDateTime(input: string | Date, timezone?: string): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(date);
}

export function formatDate(input: string | Date, timezone?: string): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: timezone,
  }).format(date);
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value < 10 && index > 0 ? 1 : 0)} ${units[index]}`;
}

/** Convert a pollutant concentration (µg/m³, CO in ppb) into a US EPA sub-index. */
export function concentrationToAqi(pollutant: Pollutant, concentration: number): number {
  const table = AQI_BREAKPOINTS[pollutant];
  if (!Number.isFinite(concentration) || concentration < 0) return 0;
  for (const row of table) {
    if (concentration <= row.cHigh) {
      const ratio = (row.iHigh - row.iLow) / (row.cHigh - row.cLow);
      return Math.round(row.iLow + ratio * (concentration - row.cLow));
    }
  }
  return 500;
}

/** Composite AQI: the maximum of all available pollutant sub-indices. */
export function compositeAqi(concentrations: Partial<Record<Pollutant, number>>): {
  aqi: number;
  dominant: Pollutant;
} {
  let aqi = 0;
  let dominant: Pollutant = 'pm25';
  for (const [key, value] of Object.entries(concentrations)) {
    if (value === undefined || value === null) continue;
    const sub = concentrationToAqi(key as Pollutant, value);
    if (sub > aqi) {
      aqi = sub;
      dominant = key as Pollutant;
    }
  }
  return { aqi, dominant };
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${Math.abs(count) === 1 ? singular : plural}`;
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

export function countryCodeToFlagEmoji(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return '🏳️';
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split('')
      .map((char) => 0x1f1e6 + char.charCodeAt(0) - 65),
  );
}
