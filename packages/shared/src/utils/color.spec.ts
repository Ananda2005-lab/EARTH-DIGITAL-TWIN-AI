import { describe, expect, it } from 'vitest';
import {
  altitudeColor,
  colorFromString,
  contrastRatio,
  depthColor,
  hexToRgb,
  luminance,
  mixColors,
  readableTextColor,
  rgbToHex,
  sampleRamp,
  withAlpha,
} from './color';
import type { LayerLegend } from '../constants/layers';

describe('hexToRgb / rgbToHex', () => {
  it('parses 6-digit hex', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('parses 3-digit hex', () => {
    expect(hexToRgb('#0f0')).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('round-trips hex through RGB', () => {
    expect(rgbToHex(hexToRgb('#38bdf8'))).toBe('#38bdf8');
  });

  it('clamps out-of-range channels on encode', () => {
    expect(rgbToHex({ r: 300, g: -5, b: 0 })).toBe('#ff0000');
  });
});

describe('mixColors', () => {
  it('returns the endpoints at t = 0 and t = 1', () => {
    expect(mixColors('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixColors('#000000', '#ffffff', 1)).toBe('#ffffff');
  });

  it('clamps t outside [0, 1]', () => {
    expect(mixColors('#000000', '#ffffff', 5)).toBe('#ffffff');
  });

  it('is the midpoint at t = 0.5', () => {
    expect(mixColors('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

describe('withAlpha', () => {
  it('builds an rgba() string', () => {
    expect(withAlpha('#00ff00', 0.5)).toBe('rgba(0, 255, 0, 0.5)');
  });

  it('clamps alpha', () => {
    expect(withAlpha('#000000', 2)).toBe('rgba(0, 0, 0, 1)');
    expect(withAlpha('#000000', -1)).toBe('rgba(0, 0, 0, 0)');
  });
});

describe('sampleRamp', () => {
  const legend: LayerLegend = {
    id: 'test',
    label: 'Test',
    kind: 'ramp',
    unit: '',
    stops: [
      { value: 0, label: 'zero', color: '#000000' },
      { value: 10, label: 'ten', color: '#ffffff' },
    ],
  };

  it('interpolates between stops', () => {
    expect(sampleRamp(legend, 5)).toBe('#808080');
  });

  it('clamps outside the ramp range', () => {
    expect(sampleRamp(legend, -5)).toBe('#000000');
    expect(sampleRamp(legend, 100)).toBe('#ffffff');
  });

  it('falls back for a legend with no numeric stops', () => {
    const empty: LayerLegend = {
      id: 'empty',
      label: 'Empty',
      kind: 'categories',
      unit: '',
      stops: [{ value: 'string', label: 'x', color: '#fff' }],
    };
    expect(sampleRamp(empty, 1)).toBe('#94a3b8');
  });
});

describe('luminance / contrastRatio / readableTextColor', () => {
  it('black is ~0 and white is ~1', () => {
    expect(luminance('#000000')).toBeCloseTo(0, 3);
    expect(luminance('#ffffff')).toBeCloseTo(1, 3);
  });

  it('contrast between black and white is the maximum', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('picks dark text on light backgrounds', () => {
    expect(readableTextColor('#ffffff')).toBe('#0b1220');
    expect(readableTextColor('#000000')).toBe('#f8fafc');
  });
});

describe('colorFromString', () => {
  it('is deterministic', () => {
    expect(colorFromString('Earth Digital Twin')).toBe(colorFromString('Earth Digital Twin'));
  });

  it('returns one of the palette colours', () => {
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
    for (const input of ['a', 'b', 'c', 'earth', 'ocean', 'space', 'sky']) {
      expect(palette).toContain(colorFromString(input));
    }
  });
});

describe('altitudeColor', () => {
  it('returns the grey fallback for null', () => {
    expect(altitudeColor(null)).toBe('#94a3b8');
  });

  it('interpolates inside the ramp and clamps outside', () => {
    expect(altitudeColor(0)).toBe('#4ade80');
    expect(altitudeColor(20_000)).toBe('#fb7185');
    expect(altitudeColor(750)).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('depthColor', () => {
  it('shallow quakes are hot, deep quakes are cool', () => {
    expect(depthColor(0)).toBe('#ef4444');
    expect(depthColor(700)).toBe('#818cf8');
    expect(depthColor(50)).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
