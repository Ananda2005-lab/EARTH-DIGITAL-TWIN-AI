import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { pointQuerySchema, searchQuerySchema, type Place } from '@edt/shared';
import { Attribution } from 'src/common/decorators/attribution.decorator';
import { CacheTtl } from 'src/common/decorators/cache-ttl.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { AppException } from 'src/common/errors/app-exception';
import { zodDto } from 'src/common/zod/zod-dto';
import { SearchService } from './search.service';

const suggestQuerySchema = z.object({
  q: z.string().trim().min(1).max(160),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export class SearchQueryDto extends zodDto(searchQuerySchema) {}
export class SuggestQueryDto extends zodDto(suggestQuerySchema) {}
export class ReverseQueryDto extends zodDto(pointQuerySchema) {}

@ApiTags('search')
@Controller('search')
@Public()
@Attribution('Earth Digital Twin gazetteer · Open-Meteo Geocoding · BigDataCloud')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @CacheTtl(600)
  @ApiOperation({
    summary: 'Search places',
    description:
      'Local gazetteer first, then the geocoder for the long tail. Raw "lat, lng" input resolves to a coordinate without a network call.',
  })
  @ApiOkResponse({ description: 'Ranked places' })
  @ApiResponse({ status: 422, description: 'Invalid query' })
  async query(@Query() query: SearchQueryDto): Promise<Place[]> {
    return this.search.search({
      q: query.q,
      limit: query.limit,
      kinds: query.kinds,
      near: query.near,
    });
  }

  @Get('suggest')
  @CacheTtl(300)
  @ApiOperation({
    summary: 'Type-ahead suggestions',
    description: 'Local data only, for keystroke-latency responses.',
  })
  @ApiOkResponse({ description: 'Suggestions' })
  async suggest(@Query() query: SuggestQueryDto): Promise<Place[]> {
    return this.search.suggest(query.q, query.limit);
  }

  @Get('reverse')
  @CacheTtl(3600)
  @ApiOperation({ summary: 'Reverse geocode a coordinate' })
  @ApiOkResponse({ description: 'Nearest named place' })
  @ApiResponse({ status: 404, description: 'Nothing resolvable at that coordinate' })
  async reverse(@Query() query: ReverseQueryDto): Promise<Place> {
    const place = await this.search.reverse({ lng: query.lng, lat: query.lat });
    if (!place) throw AppException.notFound('No place could be resolved for that coordinate');
    return place;
  }
}
