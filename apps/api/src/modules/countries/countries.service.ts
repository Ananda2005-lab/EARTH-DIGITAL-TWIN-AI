import { Injectable, Logger } from '@nestjs/common';
import type {
  Continent as PrismaContinent,
  Country,
  CountryIndicator,
  Prisma,
} from '@prisma/client';
import type {
  Continent,
  CountryDetail,
  CountrySummary,
  Currency,
  IndicatorSeries,
  Language,
  PaginatedResult,
} from '@edt/shared';
import { AppException } from 'src/common/errors/app-exception';
import { Paginated, resolveSort } from 'src/common/pagination';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { UPSTREAM_URLS } from 'src/infra/upstream/providers';
import { UpstreamService } from 'src/infra/upstream/upstream.service';
import {
  COUNTRY_DETAIL_INDICATORS,
  findIndicator,
  type CountryDetailIndicatorField,
} from '../analytics/indicators';

export interface CountryListQuery {
  page: number;
  pageSize: number;
  q?: string;
  continent?: Continent;
  subregion?: string;
  independentOnly?: boolean;
  sortBy?: string;
  sortDir: 'asc' | 'desc';
}

type WorldBankResponse = [
  { page: number; pages: number; total: number } | null,
  (
    | {
        indicator: { id: string; value: string };
        countryiso3code: string;
        date: string;
        value: number | null;
      }[]
    | null
  ),
];

const SORTABLE = ['name', 'population', 'areaKm2', 'createdAt'] as const;

/**
 * Country reference data.
 *
 * The gazetteer is the authoritative local copy (seeded from the vendored
 * reference file); World Bank series are fetched on demand and memoised into
 * `country_indicators` so the detail endpoint stays fast and works offline.
 */
@Injectable()
export class CountriesService {
  private readonly logger = new Logger(CountriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly upstream: UpstreamService,
  ) {}

  async list(query: CountryListQuery): Promise<PaginatedResult<CountrySummary>> {
    const where: Prisma.CountryWhereInput = {
      continent: query.continent ? (query.continent as PrismaContinent) : undefined,
      subregion: query.subregion,
      independent: query.independentOnly ? true : undefined,
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { officialName: { contains: query.q, mode: 'insensitive' } },
              { code: query.q.length === 2 ? query.q.toUpperCase() : undefined },
              { code3: query.q.length === 3 ? query.q.toUpperCase() : undefined },
            ],
          }
        : {}),
    };

    const sort = resolveSort(SORTABLE, 'population', query.sortBy, query.sortDir);
    const { skip, take } = Paginated.skipTake(query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.country.findMany({
        where,
        orderBy: { [sort.field]: sort.direction },
        skip,
        take,
      }),
      this.prisma.country.count({ where }),
    ]);

    return Paginated.of(rows.map(toCountrySummary), total, query);
  }

  async summary(code: string): Promise<CountrySummary> {
    const country = await this.prisma.country.findUnique({ where: { code: code.toUpperCase() } });
    if (!country) throw AppException.notFound(`No country with code ${code.toUpperCase()}`);
    return toCountrySummary(country);
  }

  async detail(code: string): Promise<CountryDetail> {
    const normalised = code.toUpperCase();
    const country = await this.prisma.country.findUnique({
      where: { code: normalised },
      include: { indicators: { orderBy: { year: 'desc' } } },
    });
    if (!country) throw AppException.notFound(`No country with code ${normalised}`);

    if (country.indicators.length === 0) {
      await this.refreshIndicators(normalised).catch((error: unknown) => {
        this.logger.warn(
          `Indicator refresh for ${normalised} failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      });
      const refreshed = await this.prisma.country.findUnique({
        where: { code: normalised },
        include: { indicators: { orderBy: { year: 'desc' } } },
      });
      if (refreshed) return toCountryDetail(refreshed, refreshed.indicators);
    }

    return toCountryDetail(country, country.indicators);
  }

  async neighbours(code: string): Promise<CountrySummary[]> {
    const country = await this.prisma.country.findUnique({
      where: { code: code.toUpperCase() },
      select: { borders: true },
    });
    if (!country) throw AppException.notFound(`No country with code ${code.toUpperCase()}`);
    if (country.borders.length === 0) return [];

    const rows = await this.prisma.country.findMany({
      where: { code3: { in: country.borders } },
      orderBy: { name: 'asc' },
    });
    return rows.map(toCountrySummary);
  }

  async cities(
    code: string,
    limit: number,
  ): Promise<{ id: string; name: string; population: number; isCapital: boolean }[]> {
    return this.prisma.city.findMany({
      where: { countryCode: code.toUpperCase() },
      orderBy: [{ isCapital: 'desc' }, { population: 'desc' }],
      take: limit,
      select: { id: true, name: true, population: true, isCapital: true },
    });
  }

  /** Stored series for one indicator, refreshing from the World Bank if absent. */
  async indicatorSeries(code: string, indicator: string, limit: number): Promise<IndicatorSeries> {
    const definition = findIndicator(indicator);
    if (!definition) throw AppException.badRequest('Unknown indicator code');

    const country = await this.prisma.country.findUnique({
      where: { code: code.toUpperCase() },
      select: { id: true, code3: true },
    });
    if (!country) throw AppException.notFound(`No country with code ${code.toUpperCase()}`);

    let rows = await this.prisma.countryIndicator.findMany({
      where: { countryId: country.id, indicator: definition.code },
      orderBy: { year: 'asc' },
      take: limit,
    });

    if (rows.length === 0) {
      await this.fetchIndicator(
        country.id,
        country.code3,
        definition.code,
        definition.label,
        definition.unit,
      );
      rows = await this.prisma.countryIndicator.findMany({
        where: { countryId: country.id, indicator: definition.code },
        orderBy: { year: 'asc' },
        take: limit,
      });
    }

    return {
      indicator: definition.code,
      label: definition.label,
      unit: definition.unit,
      source: 'World Bank Open Data',
      points: rows.map((row) => ({ year: row.year, value: row.value })),
    };
  }

  /** Pull every catalogued indicator for a country and memoise it. */
  async refreshIndicators(code: string): Promise<number> {
    const country = await this.prisma.country.findUnique({
      where: { code: code.toUpperCase() },
      select: { id: true, code3: true },
    });
    if (!country) throw AppException.notFound(`No country with code ${code.toUpperCase()}`);

    let written = 0;
    for (const indicator of Object.keys(COUNTRY_DETAIL_INDICATORS)) {
      const definition = findIndicator(indicator);
      if (!definition) continue;
      written += await this.fetchIndicator(
        country.id,
        country.code3,
        definition.code,
        definition.label,
        definition.unit,
      );
    }
    return written;
  }

  private async fetchIndicator(
    countryId: string,
    code3: string,
    indicator: string,
    label: string,
    unit: string,
  ): Promise<number> {
    const result = await this.upstream.safeJson<WorldBankResponse>(
      {
        provider: 'worldBank',
        url: `${UPSTREAM_URLS.worldBank}/country/${code3}/indicator/${indicator}`,
        query: { format: 'json', per_page: 80 },
      },
      [null, null],
    );

    const observations = (result.data[1] ?? []).filter(
      (
        entry,
      ): entry is {
        indicator: { id: string; value: string };
        countryiso3code: string;
        date: string;
        value: number;
      } => entry.value !== null && Number.isFinite(entry.value),
    );
    if (observations.length === 0) return 0;

    await this.prisma.$transaction(
      observations.map((entry) =>
        this.prisma.countryIndicator.upsert({
          where: {
            countryId_indicator_year: { countryId, indicator, year: Number(entry.date) },
          },
          create: {
            countryId,
            indicator,
            label,
            unit,
            source: 'World Bank',
            year: Number(entry.date),
            value: entry.value,
          },
          update: { value: entry.value, label, unit },
        }),
      ),
    );
    return observations.length;
  }
}

export function toCountrySummary(country: Country): CountrySummary {
  return {
    code: country.code,
    code3: country.code3,
    name: country.name,
    officialName: country.officialName,
    continent: country.continent as Continent,
    subregion: country.subregion,
    capital: country.capital,
    population: Number(country.population),
    areaKm2: country.areaKm2,
    flagEmoji: country.flagEmoji,
    center:
      country.capitalLng !== null && country.capitalLat !== null
        ? { lng: country.capitalLng, lat: country.capitalLat }
        : { lng: country.lng, lat: country.lat },
    bbox:
      country.bboxWest !== null &&
      country.bboxSouth !== null &&
      country.bboxEast !== null &&
      country.bboxNorth !== null
        ? [country.bboxWest, country.bboxSouth, country.bboxEast, country.bboxNorth]
        : undefined,
  };
}

export function toCountryDetail(country: Country, indicators: CountryIndicator[]): CountryDetail {
  const latest = new Map<CountryDetailIndicatorField, number>();
  for (const row of indicators) {
    const field =
      COUNTRY_DETAIL_INDICATORS[row.indicator as keyof typeof COUNTRY_DETAIL_INDICATORS];
    if (field && !latest.has(field)) latest.set(field, row.value);
  }
  const value = (field: CountryDetailIndicatorField): number | null => latest.get(field) ?? null;
  const population = Number(country.population);

  return {
    ...toCountrySummary(country),
    currencies: (country.currencies ?? []) as unknown as Currency[],
    languages: (country.languages ?? []) as unknown as Language[],
    timezones: country.timezones,
    callingCodes: country.callingCodes,
    tld: country.tld,
    drivingSide: country.drivingSide,
    independent: country.independent,
    unMember: country.unMember,
    landlocked: country.landlocked,
    borders: country.borders,
    gdpUsd: value('gdpUsd'),
    gdpPerCapitaUsd: value('gdpPerCapitaUsd'),
    gdpGrowthPct: value('gdpGrowthPct'),
    lifeExpectancy: value('lifeExpectancy'),
    hdi: null,
    urbanPopulationPct: value('urbanPopulationPct'),
    literacyPct: value('literacyPct'),
    internetUsersPct: value('internetUsersPct'),
    co2TonnesPerCapita: value('co2TonnesPerCapita'),
    renewableEnergyPct: value('renewableEnergyPct'),
    forestAreaPct: value('forestAreaPct'),
    populationDensity: country.areaKm2 > 0 ? Number((population / country.areaKm2).toFixed(2)) : 0,
    medianAge: null,
    fertilityRate: value('fertilityRate'),
    unemploymentPct: value('unemploymentPct'),
    inflationPct: value('inflationPct'),
    militaryExpenditurePctGdp: value('militaryExpenditurePctGdp'),
    touristArrivals: value('touristArrivals'),
    flagSvgUrl: country.flagSvgUrl,
    coatOfArmsUrl: country.coatOfArmsUrl,
    mapsUrl: country.mapsUrl,
    wikipediaUrl: country.wikipediaUrl,
    updatedAt: country.updatedAt.toISOString(),
  };
}
