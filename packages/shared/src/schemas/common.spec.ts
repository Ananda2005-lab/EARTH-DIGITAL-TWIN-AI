import { describe, expect, it } from 'vitest';
import {
  bboxSchema,
  bboxStringSchema,
  countryCodeSchema,
  idSchema,
  lngLatSchema,
  paginationSchema,
  pointQuerySchema,
  searchQuerySchema,
  sortSchema,
  viewStateSchema,
} from './common';

describe('lngLatSchema', () => {
  it('accepts valid coordinates', () => {
    expect(lngLatSchema.parse({ lng: 0, lat: 0 })).toEqual({ lng: 0, lat: 0 });
  });

  it('rejects out-of-range coordinates', () => {
    expect(lngLatSchema.safeParse({ lng: 200, lat: 0 }).success).toBe(false);
    expect(lngLatSchema.safeParse({ lng: 0, lat: 91 }).success).toBe(false);
  });
});

describe('bboxSchema', () => {
  it('accepts a valid box', () => {
    expect(bboxSchema.safeParse([-10, -10, 10, 10]).success).toBe(true);
  });

  it('rejects south above north', () => {
    expect(bboxSchema.safeParse([-10, 10, 10, -10]).success).toBe(false);
  });

  it('rejects non-tuple input', () => {
    expect(bboxSchema.safeParse([-10, -10, 10]).success).toBe(false);
  });
});

describe('bboxStringSchema', () => {
  it('parses a comma-separated string', () => {
    expect(bboxStringSchema.parse('-10,-10,10,10')).toEqual([-10, -10, 10, 10]);
  });

  it('rejects malformed strings', () => {
    expect(bboxStringSchema.safeParse('a,b,c').success).toBe(false);
    expect(bboxStringSchema.safeParse('0,0,0,0,0').success).toBe(false);
  });
});

describe('viewStateSchema', () => {
  it('applies defaults for bearing and pitch', () => {
    expect(viewStateSchema.parse({ lng: 0, lat: 0, altitude: 1000 })).toMatchObject({
      bearing: 0,
      pitch: 0,
    });
  });
});

describe('paginationSchema', () => {
  it('coerces string numbers and applies defaults', () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, pageSize: 24 });
    expect(paginationSchema.parse({ page: '2', pageSize: '50' })).toEqual({ page: 2, pageSize: 50 });
  });

  it('clamps pageSize to the maximum', () => {
    expect(paginationSchema.safeParse({ pageSize: 500 }).success).toBe(false);
  });
});

describe('sortSchema', () => {
  it('defaults sortDir to desc', () => {
    expect(sortSchema.parse({}).sortDir).toBe('desc');
  });

  it('rejects an invalid direction', () => {
    expect(sortSchema.safeParse({ sortDir: 'up' }).success).toBe(false);
  });
});

describe('idSchema', () => {
  it('accepts a UUID and rejects other strings', () => {
    expect(idSchema.safeParse('5f8d1f2e-9b3c-4a0e-b1d2-3c4d5e6f7a8b').success).toBe(true);
    expect(idSchema.safeParse('not-a-uuid').success).toBe(false);
  });
});

describe('countryCodeSchema', () => {
  it('normalises to uppercase', () => {
    expect(countryCodeSchema.parse('us')).toBe('US');
  });

  it('rejects invalid codes', () => {
    expect(countryCodeSchema.safeParse('usa').success).toBe(false);
    expect(countryCodeSchema.safeParse('1').success).toBe(false);
  });
});

describe('searchQuerySchema', () => {
  it('parses kinds and near', () => {
    const out = searchQuerySchema.parse({
      q: 'paris',
      kinds: 'city,country',
      near: '2.35,48.85',
    });
    expect(out.kinds).toEqual(['city', 'country']);
    expect(out.near).toEqual({ lng: 2.35, lat: 48.85 });
  });

  it('rejects a malformed near value', () => {
    expect(searchQuerySchema.safeParse({ q: 'x', near: 'not-coords' }).success).toBe(false);
  });

  it('rejects an empty query', () => {
    expect(searchQuerySchema.safeParse({ q: '   ' }).success).toBe(false);
  });
});

describe('pointQuerySchema', () => {
  it('coerces numeric query params', () => {
    const out = pointQuerySchema.parse({ lat: '12.5', lng: '-41.9' });
    expect(out.lat).toBe(12.5);
    expect(out.lng).toBe(-41.9);
  });

  it('rejects out-of-range values', () => {
    expect(pointQuerySchema.safeParse({ lat: 100, lng: 0 }).success).toBe(false);
  });
});
