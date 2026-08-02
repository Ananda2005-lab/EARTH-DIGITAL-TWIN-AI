import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  bboxStringSchema,
  hazardQuerySchema,
  type BBox,
  type HazardEvent,
  type HazardFeed,
  type HazardStats,
} from '@edt/shared';
import { Attribution } from 'src/common/decorators/attribution.decorator';
import { CacheTtl } from 'src/common/decorators/cache-ttl.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { zodDto } from 'src/common/zod/zod-dto';
import { HazardsService } from './hazards.service';

const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(1).max(5000).default(250),
  hours: z.coerce.number().int().min(1).max(720).default(48),
});

export class HazardQueryDto extends zodDto(hazardQuerySchema) {}
export class HazardNearbyDto extends zodDto(nearbyQuerySchema) {}

function parseBbox(raw?: string): BBox | undefined {
  if (!raw) return undefined;
  const parsed = bboxStringSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

@ApiTags('hazards')
@Controller('hazards')
@Public()
@Attribution('USGS · NASA EONET · NASA FIRMS · GDACS')
export class HazardsController {
  constructor(private readonly hazards: HazardsService) {}

  @Get()
  @CacheTtl(300)
  @ApiOperation({
    summary: 'Fused hazard feed',
    description:
      'Earthquakes, wildfires, volcanoes, floods, cyclones, droughts and landslides from four providers, de-duplicated and severity-sorted. A failing provider degrades the feed rather than the request.',
  })
  @ApiOkResponse({ description: 'Hazard feed' })
  @ApiResponse({ status: 422, description: 'Invalid filter' })
  async feed(@Query() query: HazardQueryDto): Promise<HazardFeed> {
    return this.hazards.feed({
      kinds: query.kinds,
      bbox: parseBbox(query.bbox),
      minMagnitude: query.minMagnitude,
      minSeverity: query.minSeverity,
      hours: query.hours,
      limit: query.limit,
    });
  }

  @Get('stats')
  @CacheTtl(300)
  @ApiOperation({ summary: 'Hazard counts by kind and severity' })
  @ApiOkResponse({ description: 'Aggregated statistics' })
  async stats(@Query() query: HazardQueryDto): Promise<HazardStats[]> {
    return this.hazards.stats({
      kinds: query.kinds,
      bbox: parseBbox(query.bbox),
      minMagnitude: query.minMagnitude,
      minSeverity: query.minSeverity,
      hours: query.hours,
      limit: query.limit,
    });
  }

  @Get('nearby')
  @CacheTtl(300)
  @ApiOperation({ summary: 'Hazards near a coordinate', description: 'Sorted by great-circle distance.' })
  @ApiOkResponse({ description: 'Nearby hazards with distances' })
  async nearby(@Query() query: HazardNearbyDto): Promise<(HazardEvent & { distanceKm: number })[]> {
    return this.hazards.nearby({ lng: query.lng, lat: query.lat }, query.radiusKm, query.hours);
  }
}
