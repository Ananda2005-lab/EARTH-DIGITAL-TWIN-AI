import { describe, expect, it } from 'vitest';
import {
  aqiBand,
  atLeastRole,
  describeWeatherCode,
  hasPermission,
} from './scales';

describe('aqiBand', () => {
  it('maps AQI values to bands', () => {
    expect(aqiBand(30).band).toBe('good');
    expect(aqiBand(75).band).toBe('moderate');
    expect(aqiBand(120).band).toBe('unhealthy_sensitive');
    expect(aqiBand(180).band).toBe('unhealthy');
    expect(aqiBand(250).band).toBe('very_unhealthy');
    expect(aqiBand(400).band).toBe('hazardous');
  });
});

describe('hasPermission / atLeastRole', () => {
  it('grants admin-read only to admin roles', () => {
    expect(hasPermission('admin', 'admin:read')).toBe(true);
    expect(hasPermission('owner', 'admin:read')).toBe(true);
    expect(hasPermission('user', 'admin:read')).toBe(false);
  });

  it('admin:keys is owner-only', () => {
    expect(hasPermission('admin', 'admin:keys')).toBe(false);
    expect(hasPermission('owner', 'admin:keys')).toBe(true);
  });

  it('atLeastRole orders roles', () => {
    expect(atLeastRole('owner', 'admin')).toBe(true);
    expect(atLeastRole('user', 'analyst')).toBe(false);
    expect(atLeastRole('analyst', 'analyst')).toBe(true);
  });
});

describe('describeWeatherCode', () => {
  it('maps known WMO codes', () => {
    expect(describeWeatherCode(0).condition).toBe('clear');
    expect(describeWeatherCode(95).condition).toBe('thunderstorm');
    expect(describeWeatherCode(61).label).toBe('Slight rain');
  });

  it('falls back to an unknown description', () => {
    expect(describeWeatherCode(999).label).toBe('Unknown');
  });
});
