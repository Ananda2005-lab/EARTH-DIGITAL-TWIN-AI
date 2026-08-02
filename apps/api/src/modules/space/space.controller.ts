import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { LngLat } from '@edt/shared';
import { Attribution } from 'src/common/decorators/attribution.decorator';
import { CacheTtl } from 'src/common/decorators/cache-ttl.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { AppException } from 'src/common/errors/app-exception';
import {
  SpaceService,
  type IssPosition,
  type SatelliteGroup,
  type SpaceWeather,
  type TleRecord,
} from './space.service';

const GROUP_PATTERN = /^[a-z0-9-]{2,32}$/u;

@ApiTags('space')
@Controller('space')
@Public()
@Attribution('NOAA SWPC · CelesTrak · WhereTheISS.at')
export class SpaceController {
  constructor(private readonly space: SpaceService) {}

  @Get('weather')
  @CacheTtl(900)
  @ApiOperation({
    summary: 'Space weather summary',
    description: 'Planetary Kp, solar wind, Bz and F10.7 flux, plus the aurora visibility latitude.',
  })
  @ApiOkResponse({ description: 'Space weather snapshot' })
  async weather(): Promise<SpaceWeather> {
    return this.space.spaceWeather();
  }

  @Get('iss')
  @CacheTtl(8)
  @ApiOperation({ summary: 'Current ISS position' })
  @ApiOkResponse({ description: 'ISS telemetry' })
  @ApiResponse({ status: 503, description: 'Tracking provider unavailable' })
  async iss(): Promise<IssPosition> {
    return this.space.issPosition();
  }

  @Get('iss/track')
  @CacheTtl(60)
  @ApiOperation({ summary: 'ISS ground track', description: 'Sampled forward from now.' })
  @ApiQuery({ name: 'minutes', required: false, schema: { type: 'integer', minimum: 10, maximum: 240, default: 90 } })
  @ApiOkResponse({ description: 'Ground track coordinates' })
  async issTrack(@Query('minutes') minutes?: string): Promise<LngLat[]> {
    const parsed = z.coerce.number().int().min(10).max(240).default(90).parse(minutes ?? 90);
    return this.space.issTrack(parsed);
  }

  @Get('satellites')
  @CacheTtl(21_600)
  @ApiOperation({ summary: 'Available satellite catalogue groups' })
  @ApiOkResponse({ description: 'Groups with object counts' })
  async groups(): Promise<SatelliteGroup[]> {
    return this.space.satelliteGroups();
  }

  @Get('satellites/:group')
  @CacheTtl(21_600)
  @Attribution('CelesTrak TLE catalogue')
  @ApiOperation({ summary: 'TLE records for a catalogue group' })
  @ApiParam({ name: 'group', example: 'stations' })
  @ApiOkResponse({ description: 'Two-line element sets' })
  @ApiResponse({ status: 400, description: 'Malformed group name' })
  async tle(@Param('group') group: string): Promise<TleRecord[]> {
    if (!GROUP_PATTERN.test(group)) throw AppException.badRequest('Unrecognised catalogue group');
    return this.space.tle(group);
  }
}
