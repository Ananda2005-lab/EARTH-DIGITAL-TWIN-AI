import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Queue } from 'bullmq';
import type { AppConfig } from 'src/config/configuration';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import { HazardsService } from 'src/modules/hazards/hazards.service';
import { ReportsService } from 'src/modules/reports/reports.service';
import {
  DEFAULT_JOB_OPTIONS,
  QUEUE_NAMES,
  type CacheWarmJob,
  type GenerateReportJob,
  type HazardFanOutJob,
  type UsageRollupJob,
} from './queues';

/**
 * Owns every recurring task.
 *
 * Repeatable BullMQ jobs are registered once at boot (idempotent — BullMQ
 * de-duplicates by repeat key), while lightweight housekeeping runs in-process on
 * cron. Nothing here throws: a scheduler error must never crash the app.
 */
@Injectable()
export class JobsScheduler implements OnModuleInit {
  private readonly logger = new Logger(JobsScheduler.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.hazardAlerts) private readonly hazardQueue: Queue<HazardFanOutJob>,
    @InjectQueue(QUEUE_NAMES.cacheWarm) private readonly cacheQueue: Queue<CacheWarmJob>,
    @InjectQueue(QUEUE_NAMES.usageRollup) private readonly usageQueue: Queue<UsageRollupJob>,
    @InjectQueue(QUEUE_NAMES.reports) private readonly reportQueue: Queue<GenerateReportJob>,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly hazards: HazardsService,
    private readonly reports: ReportsService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    const queue = this.config.get('queue', { infer: true });
    if (!queue.enabled) {
      this.logger.log('Background jobs disabled (JOBS_ENABLED=false)');
      return;
    }

    try {
      await this.hazardQueue.add(
        'sync-and-fan-out',
        { hours: 6 },
        { ...DEFAULT_JOB_OPTIONS, repeat: { pattern: '*/5 * * * *' }, jobId: 'hazard-fan-out' },
      );
      await this.usageQueue.add(
        'rollup',
        {},
        { ...DEFAULT_JOB_OPTIONS, repeat: { pattern: '5 * * * *' }, jobId: 'usage-rollup' },
      );
      if (queue.cacheWarmEnabled) {
        await this.cacheQueue.add(
          'warm',
          {},
          { ...DEFAULT_JOB_OPTIONS, repeat: { pattern: '*/30 * * * *' }, jobId: 'cache-warm' },
        );
      }
      this.logger.log('Repeatable jobs registered');
    } catch (error) {
      this.logger.warn(
        `Could not register repeatable jobs (is Redis reachable?): ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  /** Remove expired auth artefacts and hazard cache rows. */
  @Cron(CronExpression.EVERY_HOUR)
  async housekeeping(): Promise<void> {
    try {
      const pruned = await this.prisma.pruneExpiredTokens();
      const hazards = await this.hazards.pruneCache();
      const sessions = await this.prisma.session.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      this.logger.log(
        `Housekeeping: ${pruned.refreshTokens} refresh tokens, ${pruned.resets} resets, ${pruned.verifications} verifications, ${sessions.count} sessions, ${hazards} hazard rows`,
      );
    } catch (error) {
      this.logger.warn(
        `Housekeeping failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  /** Deliver broadcasts whose scheduled time has arrived. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async dispatchScheduledNotifications(): Promise<void> {
    try {
      const delivered = await this.notifications.dispatchScheduled();
      if (delivered > 0) this.logger.log(`Dispatched ${delivered} scheduled notifications`);
    } catch (error) {
      this.logger.warn(
        `Scheduled notification dispatch failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  /** Safety net for reports whose job was lost (queue outage, worker crash). */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async requeueStaleReports(): Promise<void> {
    if (!this.config.get('queue', { infer: true }).enabled) return;
    try {
      const stale = await this.reports.findStale(10, 20);
      for (const report of stale) {
        await this.reportQueue.add(
          'generate',
          { reportId: report.id, userId: report.userId },
          { ...DEFAULT_JOB_OPTIONS, jobId: `${report.id}:requeue:${Date.now()}` },
        );
      }
      if (stale.length > 0) this.logger.log(`Re-queued ${stale.length} stale reports`);
    } catch (error) {
      this.logger.warn(
        `Stale report sweep failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }
}
