import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { z } from 'zod';
import {
  countryCodeSchema,
  pointQuerySchema,
  type AirQualityBundle,
  type ClimateBundle,
} from '@edt/shared';
import { Attribution } from 'src/common/decorators/attribution.decorator';
import { CacheTtl } from 'src/common/decorators/cache-ttl.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { AppException } from 'src/common/errors/app-exception';
import { zodDto } from 'src/common/zod/zod-dto';
import {
  EnvironmentService,
  type CountryEnvironmentProfile,
  type EnvironmentSnapshot,
} from './environment.service';

const snapshotQuerySchema = pointQuerySchema.extend({
  includeClimate: z.coerce.boolean().default(true),
});

export class EnvironmentPointDto extends zodDto(snapshotQuerySchema) {}
export class EnvironmentCoordinateDto extends zodDto(pointQuerySchema) {}

@ApiTags('environment')
@Controller('environment')
@Public()
@Attribution('Copernicus CAMS · ERA5 · World Bank')
export class EnvironmentController {
  constructor(private readonly environment: EnvironmentService) {}

  @Get()
  @CacheTtl(1800)
  @ApiOperation({
    summary: 'Environmental snapshot for a coordinate',
    description: 'Live air quality with optional long-run climate context.',
  })
  @ApiOkResponse({ description: 'Environmental snapshot' })
  @ApiResponse({ status: 422, description: 'Invalid coordinate' })
  async snapshot(@Query() query: EnvironmentPointDto): Promise<EnvironmentSnapshot> {
    return this.environment.snapshot({ lng: query.lng, lat: query.lat }, query.includeClimate);
  }

  @Get('air-quality')
  @CacheTtl(1800)
  @ApiOperation({
    summary: 'Air quality for a coordinate',
    description: 'US EPA AQI recomputed from CAMS concentrations.',
  })
  @ApiOkResponse({ description: 'Air quality bundle' })
  async airQuality(@Query() query: EnvironmentCoordinateDto): Promise<AirQualityBundle> {
    return this.environment.airQuality({ lng: query.lng, lat: query.lat });
  }

  @Get('climate')
  @CacheTtl(86_400)
  @ApiOperation({ summary: 'Climate normals and warming trend' })
  @ApiOkResponse({ description: 'Climate bundle' })
  async climate(@Query() query: EnvironmentCoordinateDto): Promise<ClimateBundle> {
    return this.environment.climate({ lng: query.lng, lat: query.lat });
  }

  @Get('countries/:code')
  @CacheTtl(86_400)
  @ApiOperation({ summary: 'Country sustainability profile' })
  @ApiParam({ name: 'code', description: 'ISO 3166-1 alpha-2 code', example: 'DE' })
  @ApiOkResponse({ description: 'Sustainability indicators' })
  @ApiResponse({ status: 404, description: 'Unknown country' })
  async countryProfile(@Param('code') code: string): Promise<CountryEnvironmentProfile> {
    const parsed = countryCodeSchema.safeParse(code);
    if (!parsed.success) throw AppException.badRequest('Expected an ISO 3166-1 alpha-2 code');
    const profile = await this.environment.countryProfile(parsed.data);
    if (!profile) throw AppException.notFound(`No country with code ${parsed.data}`);
    return profile;
  }

  @Get('air-quality/worst')
  @CacheTtl(3600)
  @ApiOperation({ summary: 'Cities with the worst recorded air quality' })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  })
  @ApiOkResponse({ description: 'Ranked cities' })
  async worst(
    @Query('limit') limit?: string,
  ): Promise<{ id: string; name: string; countryCode: string; averageAqi: number }[]> {
    const parsed = z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .parse(limit ?? 20);
    return this.environment.worstAirQuality(parsed);
  }
}
