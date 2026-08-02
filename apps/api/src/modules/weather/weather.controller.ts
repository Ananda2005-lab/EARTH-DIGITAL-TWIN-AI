import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { bboxStringSchema, pointQuerySchema, type WeatherBundle } from '@edt/shared';
import { Attribution } from 'src/common/decorators/attribution.decorator';
import { CacheTtl } from 'src/common/decorators/cache-ttl.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { zodDto } from 'src/common/zod/zod-dto';
import {
  WeatherService,
  type GridSample,
  type GridVariable,
  type MarineConditions,
} from './weather.service';

/** `satisfies` keeps the documented query enum in lockstep with the service union. */
const GRID_VARIABLES = [
  'temperature_2m',
  'wind_speed_10m',
  'relative_humidity_2m',
  'pressure_msl',
  'cloud_cover',
] as const satisfies readonly GridVariable[];

export const gridQuerySchema = z.object({
  variable: z.enum(GRID_VARIABLES).default('temperature_2m'),
  bbox: bboxStringSchema,
  resolution: z.coerce.number().int().min(2).max(12).default(6),
});

export class PointQueryDto extends zodDto(pointQuerySchema) {}
export class GridQueryDto extends zodDto(gridQuerySchema) {}

@ApiTags('weather')
@Controller('weather')
@Public()
@Attribution('Open-Meteo · ECMWF IFS · NOAA GFS')
export class WeatherController {
  constructor(private readonly weather: WeatherService) {}

  @Get()
  @CacheTtl(600)
  @ApiOperation({
    summary: 'Forecast for a coordinate',
    description: 'Current conditions, 168 h hourly and 16 d daily in one payload.',
  })
  @ApiOkResponse({ description: 'Weather bundle' })
  @ApiResponse({ status: 422, description: 'Invalid coordinate' })
  @ApiResponse({ status: 503, description: 'Upstream provider unavailable' })
  async forecast(@Query() query: PointQueryDto): Promise<WeatherBundle> {
    return this.weather.forecast({ lng: query.lng, lat: query.lat }, query.timezone ?? 'auto');
  }

  @Get('marine')
  @CacheTtl(10_800)
  @Attribution('Open-Meteo Marine · ECMWF WAM')
  @ApiOperation({
    summary: 'Marine conditions',
    description: 'Returns null for inland coordinates.',
  })
  @ApiOkResponse({ description: 'Marine conditions or null' })
  async marine(@Query() query: PointQueryDto): Promise<MarineConditions | null> {
    return this.weather.marine({ lng: query.lng, lat: query.lat });
  }

  @Get('grid')
  @CacheTtl(1800)
  @ApiOperation({
    summary: 'Sample a scalar weather field',
    description: 'Coarse grid over a bbox for heatmap and contour rendering.',
  })
  @ApiOkResponse({ description: 'Grid samples' })
  @ApiResponse({ status: 422, description: 'Invalid bbox' })
  async grid(@Query() query: GridQueryDto): Promise<GridSample[]> {
    return this.weather.grid(query.variable, query.bbox, query.resolution);
  }

  @Get('elevation')
  @CacheTtl(86_400)
  @Attribution('Copernicus DEM via Open-Meteo')
  @ApiOperation({ summary: 'Terrain elevation at a coordinate' })
  @ApiOkResponse({ description: 'Elevation in metres' })
  async elevation(@Query() query: PointQueryDto): Promise<{ elevationM: number | null }> {
    const [elevation] = await this.weather.elevation([{ lng: query.lng, lat: query.lat }]);
    return { elevationM: elevation ?? null };
  }
}
