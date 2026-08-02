import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  correlationQuerySchema,
  indicatorQuerySchema,
  rankingQuerySchema,
  type IndicatorSeries,
} from '@edt/shared';
import { Attribution } from 'src/common/decorators/attribution.decorator';
import { CacheTtl } from 'src/common/decorators/cache-ttl.decorator';
import { RequirePermission } from 'src/common/decorators/permissions.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { zodDto } from 'src/common/zod/zod-dto';
import {
  AnalyticsService,
  type CorrelationResult,
  type PlatformOverview,
  type RankingEntry,
} from './analytics.service';
import type { IndicatorDefinition } from './indicators';

export class IndicatorQueryDto extends zodDto(indicatorQuerySchema) {}
export class RankingQueryDto extends zodDto(rankingQuerySchema) {}
export class CorrelationQueryDto extends zodDto(correlationQuerySchema) {}

@ApiTags('analytics')
@Controller('analytics')
@Attribution('World Bank Open Data')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('indicators')
  @Public()
  @CacheTtl(86_400)
  @ApiOperation({
    summary: 'Indicator catalogue',
    description: 'The allow-listed indicators the API can serve.',
  })
  @ApiOkResponse({ description: 'Indicator definitions' })
  catalogue(): readonly IndicatorDefinition[] {
    return this.analytics.catalogue();
  }

  @Get('series')
  @Public()
  @CacheTtl(86_400)
  @ApiOperation({
    summary: 'Indicator time series',
    description:
      'One series per country. Defaults to a representative comparison set when no countries are given.',
  })
  @ApiOkResponse({ description: 'Indicator series' })
  @ApiResponse({ status: 400, description: 'Unknown indicator code' })
  async series(
    @Query() query: IndicatorQueryDto,
  ): Promise<(IndicatorSeries & { countryCode: string })[]> {
    return this.analytics.series({
      indicator: query.indicator,
      countries: query.countries,
      from: query.from,
      to: query.to,
      limit: query.limit,
    });
  }

  @Get('rankings')
  @Public()
  @CacheTtl(86_400)
  @ApiOperation({
    summary: 'Rank countries by an indicator',
    description: 'Uses the latest stored observation per country.',
  })
  @ApiOkResponse({ description: 'Ranked countries' })
  @ApiResponse({ status: 400, description: 'Unknown indicator code' })
  async rankings(@Query() query: RankingQueryDto): Promise<RankingEntry[]> {
    return this.analytics.ranking({
      indicator: query.indicator,
      direction: query.direction,
      limit: query.limit,
      continent: query.continent,
    });
  }

  @Get('correlation')
  @ApiBearerAuth()
  @RequirePermission('analytics:export')
  @CacheTtl(86_400)
  @ApiOperation({
    summary: 'Correlate two indicators',
    description:
      'Pearson coefficient plus the scatter points. Requires the analytics:export capability.',
  })
  @ApiOkResponse({ description: 'Correlation result' })
  @ApiResponse({ status: 403, description: 'Missing analytics:export permission' })
  async correlation(@Query() query: CorrelationQueryDto): Promise<CorrelationResult> {
    return this.analytics.correlation({ x: query.x, y: query.y, continent: query.continent });
  }

  @Get('overview')
  @Public()
  @CacheTtl(3600)
  @ApiOperation({
    summary: 'Platform data coverage',
    description: 'Row counts and global aggregates for the dashboard.',
  })
  @ApiOkResponse({ description: 'Coverage overview' })
  async overview(): Promise<PlatformOverview> {
    return this.analytics.overview();
  }
}
