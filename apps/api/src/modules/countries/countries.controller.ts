import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  countryCodeSchema,
  paginationSchema,
  sortSchema,
  type CountryDetail,
  type CountrySummary,
  type IndicatorSeries,
  type PaginatedResult,
} from '@edt/shared';
import { ApiPaginatedResponse } from 'src/common/decorators/api-paginated-response.decorator';
import { Attribution } from 'src/common/decorators/attribution.decorator';
import { CacheTtl } from 'src/common/decorators/cache-ttl.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { AppException } from 'src/common/errors/app-exception';
import { zodDto } from 'src/common/zod/zod-dto';
import { CountriesService } from './countries.service';

const CONTINENTS = [
  'Africa',
  'Antarctica',
  'Asia',
  'Europe',
  'North America',
  'Oceania',
  'South America',
] as const;

const listQuerySchema = paginationSchema.merge(sortSchema).extend({
  q: z.string().trim().max(120).optional(),
  continent: z.enum(CONTINENTS).optional(),
  subregion: z.string().trim().max(64).optional(),
  independentOnly: z.coerce.boolean().optional(),
});

export class CountryListDto extends zodDto(listQuerySchema) {}

function parseCode(code: string): string {
  const parsed = countryCodeSchema.safeParse(code);
  if (!parsed.success) throw AppException.badRequest('Expected an ISO 3166-1 alpha-2 code');
  return parsed.data;
}

@ApiTags('countries')
@Controller('countries')
@Public()
@Attribution('Natural Earth · mledoze/countries · World Bank Open Data')
export class CountriesController {
  constructor(private readonly countries: CountriesService) {}

  @Get()
  @CacheTtl(3600)
  @ApiOperation({
    summary: 'List countries',
    description: 'Paginated gazetteer with free-text, continent and sovereignty filters.',
  })
  @ApiPaginatedResponse({ type: 'object' }, 'Country summaries')
  @ApiResponse({ status: 422, description: 'Invalid filter' })
  async list(@Query() query: CountryListDto): Promise<PaginatedResult<CountrySummary>> {
    return this.countries.list(query);
  }

  @Get(':code')
  @CacheTtl(3600)
  @ApiOperation({
    summary: 'Country detail',
    description: 'Full profile including the latest World Bank indicator values.',
  })
  @ApiParam({ name: 'code', example: 'JP' })
  @ApiOkResponse({ description: 'Country detail' })
  @ApiResponse({ status: 404, description: 'Unknown country' })
  async detail(@Param('code') code: string): Promise<CountryDetail> {
    return this.countries.detail(parseCode(code));
  }

  @Get(':code/neighbours')
  @CacheTtl(86_400)
  @ApiOperation({ summary: 'Bordering countries' })
  @ApiParam({ name: 'code', example: 'DE' })
  @ApiOkResponse({ description: 'Neighbouring countries' })
  async neighbours(@Param('code') code: string): Promise<CountrySummary[]> {
    return this.countries.neighbours(parseCode(code));
  }

  @Get(':code/cities')
  @CacheTtl(3600)
  @ApiOperation({ summary: 'Largest cities in a country', description: 'Capital first, then by population.' })
  @ApiParam({ name: 'code', example: 'BR' })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 200, default: 25 } })
  @ApiOkResponse({ description: 'Cities' })
  async cities(
    @Param('code') code: string,
    @Query('limit') limit?: string,
  ): Promise<{ id: string; name: string; population: number; isCapital: boolean }[]> {
    const parsed = z.coerce.number().int().min(1).max(200).default(25).parse(limit ?? 25);
    return this.countries.cities(parseCode(code), parsed);
  }

  @Get(':code/indicators/:indicator')
  @CacheTtl(86_400)
  @Attribution('World Bank Open Data')
  @ApiOperation({ summary: 'Indicator time series for a country' })
  @ApiParam({ name: 'code', example: 'IN' })
  @ApiParam({ name: 'indicator', example: 'NY.GDP.PCAP.CD' })
  @ApiOkResponse({ description: 'Indicator series' })
  @ApiResponse({ status: 400, description: 'Unknown indicator code' })
  async indicator(
    @Param('code') code: string,
    @Param('indicator') indicator: string,
    @Query('limit') limit?: string,
  ): Promise<IndicatorSeries> {
    const parsed = z.coerce.number().int().min(1).max(200).default(64).parse(limit ?? 64);
    return this.countries.indicatorSeries(parseCode(code), indicator, parsed);
  }
}
