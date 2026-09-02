import { WeatherService } from './weather.service';

describe('WeatherService', () => {
  const upstream = { json: jest.fn(), safeJson: jest.fn() };
  const service = new WeatherService(upstream as never);

  beforeEach(() => jest.clearAllMocks());

  it('rounds forecast coordinates and maps the upstream response', async () => {
    upstream.json.mockResolvedValue({
      data: { current: {}, hourly: { time: [] }, daily: { time: [] } },
      attribution: 'Open-Meteo',
    });

    const result = await service.forecast({ lng: 12.34567, lat: 45.67891 }, 'UTC');

    expect(upstream.json).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'openMeteoForecast',
      query: expect.objectContaining({ latitude: 45.679, longitude: 12.346, timezone: 'UTC' }),
    }));
    expect(result.location).toEqual({ lng: 12.34567, lat: 45.67891 });
    expect(result.attribution).toBe('Open-Meteo');
  });

  it('returns null when marine data is unavailable', async () => {
    upstream.safeJson.mockResolvedValue({ data: null, attribution: 'Open-Meteo' });
    await expect(service.marine({ lng: 0, lat: 0 })).resolves.toBeNull();
  });

  it('maps marine current and hourly conditions', async () => {
    upstream.safeJson.mockResolvedValue({
      data: {
        current: { wave_height: 1.2, wave_period: 8, wave_direction: 270 },
        hourly: {
          time: ['2025-01-01T00:00'],
          wave_height: [1.1],
          sea_surface_temperature: [18.5],
        },
      },
      attribution: 'Open-Meteo',
    });

    await expect(service.marine({ lng: 1, lat: 2 })).resolves.toMatchObject({
      waveHeight: 1.2,
      wavePeriod: 8,
      hourly: [{ time: '2025-01-01T00:00', waveHeight: 1.1, seaSurfaceTemperature: 18.5 }],
    });
  });

  it('does not call upstream for an empty elevation request', async () => {
    await expect(service.elevation([])).resolves.toEqual([]);
    expect(upstream.safeJson).not.toHaveBeenCalled();
  });

  it('clamps grid resolution to at least two points per axis', async () => {
    upstream.safeJson.mockResolvedValue({
      data: [
        { longitude: 0, latitude: 0, current: { temperature_2m: 10 } },
        { longitude: 0, latitude: 1, current: { temperature_2m: 11 } },
        { longitude: 1, latitude: 0, current: { temperature_2m: 12 } },
        { longitude: 1, latitude: 1, current: { temperature_2m: 13 } },
      ],
      attribution: 'Open-Meteo',
    });

    const samples = await service.grid('temperature_2m', [0, 0, 1, 1], 1);
    expect(samples).toHaveLength(4);
    expect(upstream.safeJson).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ latitude: '0,1,0,1' }) }),
      [],
    );
  });
});
