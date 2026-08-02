import { Injectable } from '@nestjs/common';
import { aqiBand, type AirQualityBundle, type ClimateBundle, type LngLat } from '@edt/shared';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { WeatherService } from '../weather/weather.service';

export interface EnvironmentSnapshot {
  location: LngLat;
  airQuality: AirQualityBundle;
  climate: ClimateBundle | null;
  advice: string;
  fetchedAt: string;
}

export interface CountryEnvironmentProfile {
  countryCode: string;
  name: string;
  co2TonnesPerCapita: number | null;
  renewableEnergyPct: number | null;
  forestAreaPct: number | null;
  protectedAreaPct: number | null;
  freshwaterWithdrawalPct: number | null;
  year: number | null;
}

const ENVIRONMENT_INDICATORS: Record<string, keyof Omit<CountryEnvironmentProfile, 'countryCode' | 'name' | 'year'>> = {
  'EN.GHG.CO2.PC.CE.AR5': 'co2TonnesPerCapita',
  'EG.FEC.RNEW.ZS': 'renewableEnergyPct',
  'AG.LND.FRST.ZS': 'forestAreaPct',
  'ER.LND.PTLD.ZS': 'protectedAreaPct',
  'ER.H2O.FWTL.ZS': 'freshwaterWithdrawalPct',
};

/**
 * Environmental view of a place: live air quality plus the long-run climate
 * context, and the curated country-level sustainability indicators.
 */
@Injectable()
export class EnvironmentService {
  constructor(
    private readonly weather: WeatherService,
    private readonly prisma: PrismaService,
  ) {}

  async snapshot(point: LngLat, includeClimate: boolean): Promise<EnvironmentSnapshot> {
    const [airQuality, climate] = await Promise.all([
      this.weather.airQuality(point),
      includeClimate ? this.weather.climate(point).catch(() => null) : Promise.resolve(null),
    ]);

    return {
      location: point,
      airQuality,
      climate,
      advice: aqiBand(airQuality.now.aqi).advice,
      fetchedAt: new Date().toISOString(),
    };
  }

  async airQuality(point: LngLat): Promise<AirQualityBundle> {
    return this.weather.airQuality(point);
  }

  async climate(point: LngLat): Promise<ClimateBundle> {
    return this.weather.climate(point);
  }

  /** Country sustainability profile assembled from stored World Bank indicators. */
  async countryProfile(code: string): Promise<CountryEnvironmentProfile | null> {
    const country = await this.prisma.country.findUnique({
      where: { code: code.toUpperCase() },
      select: {
        code: true,
        name: true,
        indicators: {
          where: { indicator: { in: Object.keys(ENVIRONMENT_INDICATORS) } },
          orderBy: { year: 'desc' },
        },
      },
    });
    if (!country) return null;

    const profile: CountryEnvironmentProfile = {
      countryCode: country.code,
      name: country.name,
      co2TonnesPerCapita: null,
      renewableEnergyPct: null,
      forestAreaPct: null,
      protectedAreaPct: null,
      freshwaterWithdrawalPct: null,
      year: null,
    };

    for (const row of country.indicators) {
      const field = ENVIRONMENT_INDICATORS[row.indicator];
      if (!field || profile[field] !== null) continue;
      profile[field] = row.value;
      profile.year = profile.year === null ? row.year : Math.max(profile.year, row.year);
    }
    return profile;
  }

  /** Cities with the worst stored air quality, for the environment dashboard. */
  async worstAirQuality(limit: number): Promise<{ id: string; name: string; countryCode: string; averageAqi: number }[]> {
    const cities = await this.prisma.city.findMany({
      where: { averageAqi: { not: null } },
      orderBy: { averageAqi: 'desc' },
      take: limit,
      select: { id: true, name: true, countryCode: true, averageAqi: true },
    });
    return cities.map((city) => ({
      id: city.id,
      name: city.name,
      countryCode: city.countryCode,
      averageAqi: city.averageAqi ?? 0,
    }));
  }
}
