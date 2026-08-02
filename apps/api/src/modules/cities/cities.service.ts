import { Injectable } from '@nestjs/common';
import type { City, Prisma } from '@prisma/client';
import type { CityDetail, CitySummary, LngLat, PaginatedResult } from '@edt/shared';
import { AppException } from 'src/common/errors/app-exception';
import { Paginated, resolveSort } from 'src/common/pagination';
import { PrismaService } from 'src/infra/prisma/prisma.service';

export interface CityListQuery {
  page: number;
  pageSize: number;
  q?: string;
  countryCode?: string;
  minPopulation?: number;
  capitalsOnly?: boolean;
  sortBy?: string;
  sortDir: 'asc' | 'desc';
}

const SORTABLE = ['population', 'name', 'metroPopulation', 'createdAt'] as const;

/** Urban gazetteer: list, detail, nearest-neighbour and per-city metrics. */
@Injectable()
export class CitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: CityListQuery): Promise<PaginatedResult<CitySummary>> {
    const where: Prisma.CityWhereInput = {
      countryCode: query.countryCode?.toUpperCase(),
      population: query.minPopulation ? { gte: query.minPopulation } : undefined,
      isCapital: query.capitalsOnly ? true : undefined,
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { asciiName: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const sort = resolveSort(SORTABLE, 'population', query.sortBy, query.sortDir);
    const { skip, take } = Paginated.skipTake(query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.city.findMany({
        where,
        orderBy: { [sort.field]: sort.direction },
        skip,
        take,
        include: { country: { select: { name: true } } },
      }),
      this.prisma.city.count({ where }),
    ]);

    return Paginated.of(
      rows.map((row) => toCitySummary(row, row.country.name)),
      total,
      query,
    );
  }

  async detail(id: string): Promise<CityDetail> {
    const city = await this.prisma.city.findUnique({
      where: { id },
      include: { country: { select: { name: true } } },
    });
    if (!city) throw AppException.notFound('City not found');
    return toCityDetail(city, city.country.name);
  }

  async bySlug(countryCode: string, slug: string): Promise<CityDetail> {
    const city = await this.prisma.city.findUnique({
      where: { countryCode_slug: { countryCode: countryCode.toUpperCase(), slug } },
      include: { country: { select: { name: true } } },
    });
    if (!city) throw AppException.notFound('City not found');
    return toCityDetail(city, city.country.name);
  }

  /** Nearest cities to a coordinate, using the great-circle SQL helper. */
  async nearest(
    point: LngLat,
    limit: number,
  ): Promise<{ id: string; name: string; countryCode: string; distanceKm: number }[]> {
    const rows = await this.prisma.nearestCities(point.lng, point.lat, limit);
    return rows.map((row) => ({ ...row, distanceKm: Number(row.distanceKm.toFixed(1)) }));
  }

  async metrics(
    id: string,
  ): Promise<
    { metric: string; label: string; unit: string; period: string; value: number; source: string }[]
  > {
    const exists = await this.prisma.city.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw AppException.notFound('City not found');
    const rows = await this.prisma.cityMetric.findMany({
      where: { cityId: id },
      orderBy: [{ metric: 'asc' }, { period: 'desc' }],
    });
    return rows.map((row) => ({
      metric: row.metric,
      label: row.label,
      unit: row.unit,
      period: row.period,
      value: row.value,
      source: row.source,
    }));
  }
}

export function toCitySummary(city: City, countryName: string): CitySummary {
  return {
    id: city.id,
    name: city.name,
    asciiName: city.asciiName,
    countryCode: city.countryCode,
    countryName,
    admin1: city.admin1,
    population: city.population,
    center: { lng: city.lng, lat: city.lat },
    elevationM: city.elevationM,
    timezone: city.timezone,
    isCapital: city.isCapital,
  };
}

export function toCityDetail(city: City, countryName: string): CityDetail {
  return {
    ...toCitySummary(city, countryName),
    metroPopulation: city.metroPopulation,
    areaKm2: city.areaKm2,
    populationDensity:
      city.populationDensity ??
      (city.areaKm2 && city.areaKm2 > 0
        ? Number((city.population / city.areaKm2).toFixed(1))
        : null),
    foundedYear: city.foundedYear,
    gdpUsd: city.gdpUsd === null ? null : Number(city.gdpUsd),
    costOfLivingIndex: city.costOfLivingIndex,
    qualityOfLifeIndex: city.qualityOfLifeIndex,
    safetyIndex: city.safetyIndex,
    transitScore: city.transitScore,
    walkScore: city.walkScore,
    averageTemperature: city.averageTemperature,
    averageAqi: city.averageAqi,
    nearestAirports: city.nearestAirports,
    sisterCities: city.sisterCities,
    wikipediaUrl: city.wikipediaUrl,
    summary: city.summary,
    updatedAt: city.updatedAt.toISOString(),
  };
}
