import type { LayerLegend } from '../constants/layers';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const int = Number.parseInt(full, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const toHex = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function mixColors(from: string, to: string, t: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const clamped = Math.min(1, Math.max(0, t));
  return rgbToHex({
    r: a.r + (b.r - a.r) * clamped,
    g: a.g + (b.g - a.g) * clamped,
    b: a.b + (b.b - a.b) * clamped,
  });
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
}

/** Sample a legend ramp at an arbitrary value, interpolating between stops. */
export function sampleRamp(legend: LayerLegend, value: number): string {
  const numericStops = legend.stops.filter((s) => typeof s.value === 'number') as {
    value: number;
    label: string;
    color: string;
  }[];
  if (numericStops.length === 0) return '#94a3b8';
  const first = numericStops[0]!;
  const last = numericStops[numericStops.length - 1]!;
  if (value <= first.value) return first.color;
  if (value >= last.value) return last.color;
  for (let i = 0; i < numericStops.length - 1; i += 1) {
    const a = numericStops[i]!;
    const b = numericStops[i + 1]!;
    if (value >= a.value && value <= b.value) {
      const t = (value - a.value) / (b.value - a.value || 1);
      return mixColors(a.color, b.color, t);
    }
  }
  return last.color;
}

/** Perceived luminance, used to pick readable label colours over data fills. */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export function readableTextColor(background: string): '#0b1220' | '#f8fafc' {
  return luminance(background) > 0.45 ? '#0b1220' : '#f8fafc';
}

/** Deterministic accent colour for arbitrary strings (avatars, tags, collections). */
export function colorFromString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  const palette = [
    '#38bdf8',
    '#818cf8',
    '#c084fc',
    '#f472b6',
    '#fb7185',
    '#fb923c',
    '#facc15',
    '#4ade80',
    '#2dd4bf',
    '#60a5fa',
  ];
  return palette[Math.abs(hash) % palette.length]!;
}

export const ALTITUDE_RAMP = [
  { value: 0, color: '#4ade80' },
  { value: 1500, color: '#22d3ee' },
  { value: 4000, color: '#60a5fa' },
  { value: 8000, color: '#a78bfa' },
  { value: 11_000, color: '#f472b6' },
  { value: 14_000, color: '#fb7185' },
];

/** Colour an aircraft by barometric altitude in metres. */
export function altitudeColor(altitudeM: number | null): string {
  if (altitudeM === null) return '#94a3b8';
  for (let i = 0; i < ALTITUDE_RAMP.length - 1; i += 1) {
    const a = ALTITUDE_RAMP[i]!;
    const b = ALTITUDE_RAMP[i + 1]!;
    if (altitudeM >= a.value && altitudeM <= b.value) {
      return mixColors(a.color, b.color, (altitudeM - a.value) / (b.value - a.value));
    }
  }
  return ALTITUDE_RAMP[ALTITUDE_RAMP.length - 1]!.color;
}

/** Colour an earthquake by focal depth in km (shallow = hotter). */
export function depthColor(depthKm: number): string {
  const stops = [
    { value: 0, color: '#ef4444' },
    { value: 35, color: '#f97316' },
    { value: 70, color: '#facc15' },
    { value: 150, color: '#4ade80' },
    { value: 300, color: '#38bdf8' },
    { value: 700, color: '#818cf8' },
  ];
  for (let i = 0; i < stops.length - 1; i += 1) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    if (depthKm >= a.value && depthKm <= b.value) {
      return mixColors(a.color, b.color, (depthKm - a.value) / (b.value - a.value));
    }
  }
  return stops[stops.length - 1]!.color;
}
