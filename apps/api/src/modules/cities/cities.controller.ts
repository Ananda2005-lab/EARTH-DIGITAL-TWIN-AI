import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  idSchema,
  paginationSchema,
  sortSchema,
  type CityDetail,
  type CitySummary,
  type PaginatedResult,
} from '@edt/shared';
import { ApiPaginatedResponse } from 'src/common/decorators/api-paginated-response.decorator';
import { Attribution } from 'src/common/decorators/attribution.decorator';
import { CacheTtl } from 'src/common/decorators/cache-ttl.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { AppException } from 'src/common/errors/app-exception';
import { zodDto } from 'src/common/zod/zod-dto';
import { CitiesService } from './cities.service';

const listQuerySchema = paginationSchema.merge(sortSchema).extend({
  q: z.string().trim().max(120).optional(),
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/u)
    .transform((value) => value.toUpperCase())
    .optional(),
  minPopulation: z.coerce.number().int().min(0).max(50_000_000).optional(),
  capitalsOnly: z.coerce.boolean().optional(),
});

const nearestQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export class CityListDto extends zodDto(listQuerySchema) {}
export class CityNearestDto extends zodDto(nearestQuerySchema) {}

@ApiTags('cities')
@Controller('cities')
@Public()
@Attribution('GeoNames · Open-Meteo Geocoding')
export class CitiesController {
  constructor(private readonly cities: CitiesService) {}

  @Get()
  @CacheTtl(3600)
  @ApiOperation({ summary: 'List cities', description: 'Paginated urban gazetteer with search and population filters.' })
  @ApiPaginatedResponse({ type: 'object' }, 'City summaries')
  @ApiResponse({ status: 422, description: 'Invalid filter' })
  async list(@Query() query: CityListDto): Promise<PaginatedResult<CitySummary>> {
    return this.cities.list(query);
  }

  @Get('nearest')
  @CacheTtl(3600)
  @ApiOperation({ summary: 'Nearest cities to a coordinate' })
  @ApiOkResponse({ description: 'Cities ordered by distance' })
  async nearest(
    @Query() query: CityNearestDto,
  ): Promise<{ id: string; name: string; countryCode: string; distanceKm: number }[]> {
    return this.cities.nearest({ lng: query.lng, lat: query.lat }, query.limit);
  }

  @Get(':id')
  @CacheTtl(3600)
  @ApiOperation({ summary: 'City detail' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'City detail' })
  @ApiResponse({ status: 404, description: 'Unknown city' })
  async detail(@Param('id') id: string): Promise<CityDetail> {
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) throw AppException.badRequest('City id must be a UUID');
    return this.cities.detail(parsed.data);
  }

  @Get(':id/metrics')
  @CacheTtl(3600)
  @ApiOperation({ summary: 'Stored metrics for a city' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'City metrics' })
  @ApiResponse({ status: 404, description: 'Unknown city' })
  async metrics(
    @Param('id') id: string,
  ): Promise<{ metric: string; label: string; unit: string; period: string; value: number; source: string }[]> {
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) throw AppException.badRequest('City id must be a UUID');
    return this.cities.metrics(parsed.data);
  }

  @Get('by-slug/:countryCode/:slug')
  @CacheTtl(3600)
  @ApiOperation({ summary: 'City detail by country and slug', description: 'Stable URLs for the web tier.' })
  @ApiParam({ name: 'countryCode', example: 'FR' })
  @ApiParam({ name: 'slug', example: 'paris' })
  @ApiOkResponse({ description: 'City detail' })
  @ApiResponse({ status: 404, description: 'Unknown city' })
  async bySlug(@Param('countryCode') countryCode: string, @Param('slug') slug: string): Promise<CityDetail> {
    if (!/^[A-Za-z]{2}$/u.test(countryCode)) throw AppException.badRequest('Expected an ISO 3166-1 alpha-2 code');
    return this.cities.bySlug(countryCode, slug);
  }
}
