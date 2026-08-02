import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { HazardsModule } from '../hazards/hazards.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReportsModule } from '../reports/reports.module';
import { WeatherModule } from '../weather/weather.module';
import { JobsScheduler } from './jobs.scheduler';
import { CacheWarmProcessor } from './processors/cache-warm.processor';
import { HazardAlertProcessor } from './processors/hazard-alert.processor';
import { ReportProcessor } from './processors/report.processor';
import { UsageRollupProcessor } from './processors/usage-rollup.processor';
import { QUEUE_NAMES } from './queues';

/**
 * Background work: report generation, hazard alert fan-out, cache warming and
 * usage roll-ups. Producers live in their own domain modules; this module owns
 * the workers and the schedule.
 */
@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.reports },
      { name: QUEUE_NAMES.hazardAlerts },
      { name: QUEUE_NAMES.cacheWarm },
      { name: QUEUE_NAMES.usageRollup },
    ),
    ReportsModule,
    AiModule,
    HazardsModule,
    NotificationsModule,
    WeatherModule,
  ],
  providers: [ReportProcessor, HazardAlertProcessor, CacheWarmProcessor, UsageRollupProcessor, JobsScheduler],
})
export class JobsModule {}
