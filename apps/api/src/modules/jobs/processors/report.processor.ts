import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import type { AppConfig } from 'src/config/configuration';
import { AiService } from 'src/modules/ai/ai.service';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import { ReportsService } from 'src/modules/reports/reports.service';
import { QUEUE_NAMES, type GenerateReportJob } from '../queues';

/**
 * Generates a queued report by delegating to the AI service, then notifies the
 * requester. Failures are recorded on the row so the user sees a reason and can
 * retry, and BullMQ's own retry policy handles transient upstream errors.
 */
@Processor(QUEUE_NAMES.reports, { concurrency: 2 })
export class ReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportProcessor.name);

  constructor(
    private readonly reports: ReportsService,
    private readonly ai: AiService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {
    super();
  }

  async process(job: Job<GenerateReportJob>): Promise<void> {
    const { reportId, userId } = job.data;
    const report = await this.reports.findForGeneration(reportId);
    if (!report) {
      this.logger.warn(`Report ${reportId} disappeared before generation`);
      return;
    }
    if (report.status === 'ready') return;

    const startedAt = Date.now();
    await this.reports.markGenerating(reportId);

    try {
      const generated = await this.ai.generateReportContent(
        userId,
        {
          id: report.id,
          kind: report.kind,
          title: report.title,
          target: (report.target ?? {}) as Record<string, unknown>,
          tone: report.tone,
          includeCharts: report.includeCharts,
        },
        `job:${job.id ?? reportId}`,
      );

      await this.reports.markReady(reportId, {
        title: generated.title,
        summary: generated.summary,
        content: generated.content,
        sections: generated.sections,
        tokensUsed: generated.tokensUsed,
        generationMs: Date.now() - startedAt,
      });

      await this.notifications.create({
        userId,
        kind: 'report',
        severity: 'success',
        title: 'Your report is ready',
        body: `"${generated.title}" finished generating in ${Math.round((Date.now() - startedAt) / 1000)}s.`,
        actionUrl: `${this.config.get('webAppUrl', { infer: true })}/reports/${reportId}`,
        email: true,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown generation failure';
      await this.reports.markFailed(reportId, reason);
      await this.notifications.create({
        userId,
        kind: 'report',
        severity: 'warning',
        title: 'Report generation failed',
        body: `"${report.title}" could not be generated: ${reason}`,
        actionUrl: `${this.config.get('webAppUrl', { infer: true })}/reports/${reportId}`,
      });
      throw error;
    }
  }
}
