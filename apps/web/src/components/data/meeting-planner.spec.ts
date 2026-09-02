import { describe, expect, it } from 'vitest';

import { parseOffsetMinutes, zonedWallToUtc } from './meeting-planner';

describe('parseOffsetMinutes', () => {
  it('parses +HH:MM', () => {
    expect(parseOffsetMinutes('+05:30')).toBe(330);
  });

  it('parses -HH', () => {
    expect(parseOffsetMinutes('-8')).toBe(-480);
  });

  it('parses +0 as zero', () => {
    expect(parseOffsetMinutes('+0')).toBe(0);
  });

  it('handles garbage by returning 0', () => {
    expect(parseOffsetMinutes('nope')).toBe(0);
  });
});

describe('zonedWallToUtc', () => {
  it('converts New York EDT (UTC-4) to 13:00 UTC', () => {
    expect(zonedWallToUtc('2026-08-07', '09:00', 'America/New_York').toISOString()).toBe(
      '2026-08-07T13:00:00.000Z',
    );
  });

  it('converts New York EST (UTC-5) to 14:00 UTC', () => {
    expect(zonedWallToUtc('2026-01-15', '09:00', 'America/New_York').toISOString()).toBe(
      '2026-01-15T14:00:00.000Z',
    );
  });

  it('converts Mumbai (UTC+5:30) to 03:30 UTC', () => {
    expect(zonedWallToUtc('2026-08-07', '09:00', 'Asia/Kolkata').toISOString()).toBe(
      '2026-08-07T03:30:00.000Z',
    );
  });

  it('converts London BST (UTC+1) to 08:00 UTC', () => {
    expect(zonedWallToUtc('2026-08-07', '09:00', 'Europe/London').toISOString()).toBe(
      '2026-08-07T08:00:00.000Z',
    );
  });
});
