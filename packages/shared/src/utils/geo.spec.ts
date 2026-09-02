import { describe, expect, it } from 'vitest';
import {
  altitudeForZoom,
  bboxAreaKm2,
  bboxCenter,
  bboxContains,
  bboxFromCenter,
  clamp,
  clampLatitude,
  centroid,
  destinationPoint,
  expandBBox,
  greatCircleArc,
  haversineDistance,
  initialBearing,
  isDaylight,
  lngLatToVector3,
  normaliseLongitude,
  pointInRing,
  solarElevation,
  subsolarPoint,
  vector3ToLngLat,
  zoomForAltitude,
  zoomForBBox,
} from './geo';

describe('clamp', () => {
  it('clamps values into the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('normaliseLongitude', () => {
  it('wraps into [-180, 180]', () => {
    expect(normaliseLongitude(190)).toBe(-170);
    expect(normaliseLongitude(-190)).toBe(170);
    expect(normaliseLongitude(360)).toBe(0);
    expect(normaliseLongitude(540)).toBe(180);
    expect(normaliseLongitude(0)).toBe(0);
  });
});

describe('clampLatitude', () => {
  it('clamps to the polar extremes', () => {
    expect(clampLatitude(120)).toBe(90);
    expect(clampLatitude(-120)).toBe(-90);
    expect(clampLatitude(45)).toBe(45);
  });
});

describe('haversineDistance', () => {
  it('is zero for identical points', () => {
    expect(haversineDistance({ lng: 0, lat: 0 }, { lng: 0, lat: 0 })).toBe(0);
  });

  it('is symmetric', () => {
    const a = { lng: 12.5, lat: 41.9 };
    const b = { lng: 2.35, lat: 48.85 };
    expect(haversineDistance(a, b)).toBeCloseTo(haversineDistance(b, a), 6);
  });

  it('matches a known distance (Paris → Rome ≈ 1106 km)', () => {
    const d = haversineDistance({ lng: 2.3522, lat: 48.8566 }, { lng: 12.4964, lat: 41.9028 });
    expect(d / 1000).toBeCloseTo(1106, -1);
  });
});

describe('initialBearing', () => {
  it('returns a value in [0, 360)', () => {
    const b = initialBearing({ lng: 0, lat: 0 }, { lng: 10, lat: 10 });
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
  });

  it('is 0 for due-north travel', () => {
    expect(initialBearing({ lng: 0, lat: 0 }, { lng: 0, lat: 10 })).toBeCloseTo(0, 5);
  });
});

describe('destinationPoint', () => {
  it('round-trips against the inverse distance', () => {
    const origin = { lng: 12.5, lat: 41.9 };
    const dest = destinationPoint(origin, 90, 100_000);
    const back = haversineDistance(origin, dest);
    expect(back).toBeCloseTo(100_000, 0);
  });
});

describe('greatCircleArc', () => {
  it('returns start and end as the first/last points', () => {
    const a = { lng: -74, lat: 40.7 };
    const b = { lng: 2.35, lat: 48.85 };
    const arc = greatCircleArc(a, b, 8);
    expect(arc).toHaveLength(9);
    expect(arc[0]!.lng).toBeCloseTo(a.lng, 6);
    expect(arc[0]!.lat).toBeCloseTo(a.lat, 6);
    expect(arc[arc.length - 1]!.lng).toBeCloseTo(b.lng, 6);
    expect(arc[arc.length - 1]!.lat).toBeCloseTo(b.lat, 6);
  });

  it('short-circuits to [a, b] for identical points', () => {
    const a = { lng: 10, lat: 10 };
    expect(greatCircleArc(a, a)).toEqual([a, a]);
  });
});

describe('bbox helpers', () => {
  const bbox: [number, number, number, number] = [-10, -10, 10, 10];

  it('bboxCenter is the average', () => {
    expect(bboxCenter(bbox)).toEqual({ lng: 0, lat: 0 });
  });

  it('bboxContains handles simple and anti-meridian boxes', () => {
    expect(bboxContains(bbox, { lng: 0, lat: 0 })).toBe(true);
    expect(bboxContains(bbox, { lng: 20, lat: 20 })).toBe(false);
    expect(bboxContains([170, -10, -170, 10], { lng: 175, lat: 0 })).toBe(true);
    expect(bboxContains([170, -10, -170, 10], { lng: 0, lat: 0 })).toBe(false);
  });

  it('expandBBox grows the box around its centre', () => {
    const [w, s, e, n] = expandBBox(bbox, 2);
    expect(w).toBe(-20);
    expect(s).toBe(-20);
    expect(e).toBe(20);
    expect(n).toBe(20);
  });

  it('bboxFromCenter creates a box with the requested radius', () => {
    const [w, s, e, n] = bboxFromCenter({ lng: 0, lat: 0 }, 111_195);
    expect(w).toBeCloseTo(-1, 0);
    expect(e).toBeCloseTo(1, 0);
    expect(s).toBeCloseTo(-1, 0);
    expect(n).toBeCloseTo(1, 0);
  });

  it('bboxAreaKm2 is positive for a non-degenerate box', () => {
    expect(bboxAreaKm2(bbox)).toBeGreaterThan(0);
  });

  it('zoomForBBox returns a bounded zoom', () => {
    const zoom = zoomForBBox(bbox);
    expect(zoom).toBeGreaterThan(0);
    expect(zoom).toBeLessThanOrEqual(20);
  });

  it('zoomForAltitude inverts altitudeForZoom', () => {
    expect(zoomForAltitude(altitudeForZoom(8), 0)).toBeCloseTo(8, 5);
    expect(zoomForAltitude(1e9, 0)).toBe(0);
  });
});

describe('vector conversions', () => {
  it('lngLatToVector3 is a unit vector', () => {
    const v = lngLatToVector3(45, 30, 1);
    const mag = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
    expect(mag).toBeCloseTo(1, 10);
  });

  it('round-trips lng/lat through the vector', () => {
    for (const [lng, lat] of [[0, 0], [12.5, 41.9], [-122.4, 37.77], [179.9, -89]]) {
      const v = lngLatToVector3(lng, lat, 1);
      const back = vector3ToLngLat(v[0], v[1], v[2]);
      expect(back.lng).toBeCloseTo(lng, 3);
      expect(back.lat).toBeCloseTo(lat, 3);
    }
  });
});

describe('solar geometry', () => {
  it('subsolarPoint lies within latitude ±23.5°', () => {
    const p = subsolarPoint(new Date('2026-06-21T12:00:00Z'));
    expect(Math.abs(p.lat)).toBeLessThanOrEqual(23.5);
  });

  it('solar elevation is 90° at the subsolar point', () => {
    const p = subsolarPoint(new Date('2026-03-20T12:00:00Z'));
    const elev = solarElevation(p, new Date('2026-03-20T12:00:00Z'));
    expect(elev).toBeGreaterThan(88);
  });

  it('isDaylight is false at the antipode of the subsolar point', () => {
    const sun = subsolarPoint(new Date('2026-06-21T12:00:00Z'));
    const night = { lng: sun.lng + 180, lat: -sun.lat };
    expect(isDaylight(night, new Date('2026-06-21T12:00:00Z'))).toBe(false);
  });
});

describe('pointInRing', () => {
  const square: [number, number][] = [
    [0, 0],
    [0, 10],
    [10, 10],
    [10, 0],
  ];

  it('detects inside and outside points', () => {
    expect(pointInRing({ lng: 5, lat: 5 }, square)).toBe(true);
    expect(pointInRing({ lng: 15, lat: 5 }, square)).toBe(false);
  });
});

describe('centroid', () => {
  it('returns origin for empty input', () => {
    expect(centroid([])).toEqual({ lng: 0, lat: 0 });
  });

  it('returns the point for a single coordinate', () => {
    expect(centroid([{ lng: 30, lat: 40 }])).toEqual({ lng: 30, lat: 40 });
  });

  it('averages symmetric points around the equator', () => {
    const c = centroid([
      { lng: 0, lat: 10 },
      { lng: 0, lat: -10 },
    ]);
    expect(c.lat).toBeCloseTo(0, 6);
  });
});
