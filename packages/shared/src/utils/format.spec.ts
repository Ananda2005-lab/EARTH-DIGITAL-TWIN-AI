import { describe, expect, it } from 'vitest';
import {
  beaufortFor,
  compositeAqi,
  concentrationToAqi,
  countryCodeToFlagEmoji,
  formatArea,
  formatBearing,
  formatBytes,
  formatClock,
  formatCompact,
  formatCoordinates,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDistance,
  formatDms,
  formatDuration,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  formatSpeed,
  formatTemperature,
  pluralise,
  slugify,
  truncate,
} from './format';

describe('fallback formatting', () => {
  it('returns an em dash for nullish / non-finite input', () => {
    expect(formatCompact(null)).toBe('—');
    expect(formatNumber(undefined)).toBe('—');
    expect(formatPercent(Number.NaN)).toBe('—');
    expect(formatCurrency(null)).toBe('—');
    expect(formatTemperature(undefined)).toBe('—');
    expect(formatDistance(Number.POSITIVE_INFINITY)).toBe('—');
    expect(formatSpeed(null)).toBe('—');
    expect(formatArea(undefined)).toBe('—');
    expect(formatDuration(null)).toBe('—');
    expect(formatBearing(Number.NaN)).toBe('—');
  });
});

describe('formatCompact / formatNumber / formatPercent / formatCurrency', () => {
  it('compacts large numbers', () => {
    expect(formatCompact(1_234_567)).toBe('1.2M');
  });

  it('formats integers with fixed digits', () => {
    expect(formatNumber(12, 2)).toBe('12.00');
    expect(formatNumber(1234)).toBe('1,234');
  });

  it('formats percentages', () => {
    expect(formatPercent(0.456)).toBe('0.5%');
    expect(formatPercent(12)).toBe('12.0%');
  });

  it('formats currency', () => {
    expect(formatCurrency(42)).toBe('$42.0');
    expect(formatCurrency(1_000_000, 'USD')).toMatch(/^\$1(\.0)?M$/);
  });
});

describe('formatTemperature', () => {
  it('converts to fahrenheit', () => {
    expect(formatTemperature(0)).toBe('0°C');
    expect(formatTemperature(0, 'fahrenheit')).toBe('32°F');
    expect(formatTemperature(100, 'fahrenheit')).toBe('212°F');
  });
});

describe('formatDistance', () => {
  it('formats metric', () => {
    expect(formatDistance(500)).toBe('500 m');
    expect(formatDistance(1500)).toBe('1.5 km');
    expect(formatDistance(12_000)).toBe('12 km');
  });

  it('formats imperial', () => {
    expect(formatDistance(300, 'imperial')).toBe('984 ft');
    expect(formatDistance(1609, 'imperial')).toBe('1.0 mi');
    expect(formatDistance(100_000, 'imperial')).toBe('62 mi');
  });
});

describe('formatSpeed / formatArea', () => {
  it('formats speed', () => {
    expect(formatSpeed(100)).toBe('100 km/h');
    expect(formatSpeed(100, 'imperial')).toBe('62 mph');
  });

  it('formats area', () => {
    expect(formatArea(1_234_567)).toBe('1.2M km²');
    expect(formatArea(10, 'imperial')).toBe('3.9 mi²');
  });
});

describe('formatCoordinates / formatDms', () => {
  it('formats signed coordinates', () => {
    expect(formatCoordinates(12.5, -41.9)).toBe('41.9000°S, 12.5000°E');
  });

  it('formats DMS', () => {
    expect(formatDms(12.5, 41.5)).toBe("41°30'0.0\"N 12°30'0.0\"E");
    expect(formatDms(-73.98, 40.71)).toMatch(/40°42'36\.0"N 73°58'48\.0"W/);
  });
});

describe('formatBearing', () => {
  it('maps degrees to compass points', () => {
    expect(formatBearing(0)).toBe('N 0°');
    expect(formatBearing(90)).toBe('E 90°');
    expect(formatBearing(360)).toBe('N 360°');
    expect(formatBearing(-45)).toBe('NW -45°');
  });
});

describe('beaufortFor', () => {
  it('selects the correct force', () => {
    expect(beaufortFor(0).force).toBe(0);
    expect(beaufortFor(10).force).toBe(2);
    expect(beaufortFor(50).force).toBe(7);
    expect(beaufortFor(200).force).toBe(12);
  });
});

describe('formatDuration', () => {
  it('formats seconds to human units', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(125)).toBe('2m 5s');
    expect(formatDuration(3700)).toBe('1h 1m');
    expect(formatDuration(90_000)).toBe('1d 1h');
    expect(formatDuration(-60)).toBe('1m 0s');
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-01-01T00:00:00Z').getTime();
  it('formats past and future deltas', () => {
    expect(formatRelativeTime(now - 30_000, now)).toBe('30 seconds ago');
    expect(formatRelativeTime(now + 60_000, now)).toBe('in 1 minute');
    expect(formatRelativeTime(now - 2 * 86_400_000, now)).toBe('2 days ago');
  });

  it('returns an em dash for invalid dates', () => {
    expect(formatRelativeTime('not-a-date', now)).toBe('—');
  });
});

describe('formatClock / formatDate / formatDateTime', () => {
  const date = new Date('2026-08-06T12:34:00Z');
  it('formats a clock time', () => {
    expect(formatClock(date, 'UTC')).toBe('12:34');
  });

  it('formats a date', () => {
    expect(formatDate(date, 'UTC')).toBe('06 Aug 2026');
  });

  it('formats a date-time', () => {
    expect(formatDateTime(date, 'UTC')).toBe('06 Aug 2026, 12:34');
  });

  it('returns an em dash for invalid dates', () => {
    expect(formatDate('garbage')).toBe('—');
  });
});

describe('formatBytes', () => {
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('air quality conversions', () => {
  it('maps pm25 concentration to a US EPA index', () => {
    expect(concentrationToAqi('pm25', 0)).toBe(0);
    expect(concentrationToAqi('pm25', 12)).toBe(50);
    expect(concentrationToAqi('pm25', 35.4)).toBe(100);
    expect(concentrationToAqi('pm25', 55.4)).toBe(150);
    expect(concentrationToAqi('pm25', 600)).toBe(500);
    expect(concentrationToAqi('pm25', -5)).toBe(0);
  });

  it('composite AQI takes the dominant pollutant', () => {
    const { aqi, dominant } = compositeAqi({ pm25: 10, no2: 150 });
    expect(dominant).toBe('no2');
    expect(aqi).toBe(concentrationToAqi('no2', 150));
  });
});

describe('pluralise / truncate / slugify / flag emoji', () => {
  it('pluralises', () => {
    expect(pluralise(1, 'city')).toBe('1 city');
    expect(pluralise(3, 'city', 'cities')).toBe('3 cities');
  });

  it('truncates', () => {
    expect(truncate('hello world', 5)).toBe('hell…');
    expect(truncate('short', 50)).toBe('short');
  });

  it('slugifies', () => {
    expect(slugify('  Hello, Wörld!  ')).toBe('hello-world');
    expect(slugify('Already-Lower-Case')).toBe('already-lower-case');
  });

  it('builds flag emoji from country codes', () => {
    expect(countryCodeToFlagEmoji('US')).toBe('\u{1F1FA}\u{1F1F8}');
    expect(countryCodeToFlagEmoji('x')).toBe('🏳️');
  });
});
