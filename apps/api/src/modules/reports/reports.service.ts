import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type {
  Prisma,
  ReportSection as ReportSectionRow,
  Report as ReportRow,
} from '@prisma/client';
import type {
  CreateReportInput,
  PaginatedResult,
  Report,
  ReportChart,
  ReportSection,
} from '@edt/shared';
import { AppException } from 'src/common/errors/app-exception';
import { Paginated, resolveSort } from 'src/common/pagination';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { DEFAULT_JOB_OPTIONS, QUEUE_NAMES, type GenerateReportJob } from '../jobs/queues';

export interface ReportListQuery {
  page: number;
  pageSize: number;
  status?: Report['status'];
  kind?: string;
  q?: string;
  sortBy?: string;
  sortDir: 'asc' | 'desc';
}

const SORTABLE = ['createdAt', 'completedAt', 'title'] as const;

const DEFAULT_TITLES: Record<Report['kind'], string> = {
  country_profile: 'Country profile',
  city_profile: 'City profile',
  area_summary: 'Area summary',
  environmental_risk: 'Environmental risk assessment',
  climate_outlook: 'Climate outlook',
  comparison: 'Comparison brief',
  travel_plan: 'Travel plan',
  custom: 'Custom analysis',
};

/**
 * Report lifecycle. Creation is synchronous and cheap (a `queued` row plus a job);
 * the expensive generation happens in the `reports` queue so an HTTP request is
 * never blocked on the model.
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.reports) private readonly queue: Queue<GenerateReportJob>,
  ) {}

  async list(userId: string, query: ReportListQuery): Promise<PaginatedResult<Report>> {
    const where: Prisma.ReportWhereInput = {
      userId,
      status: query.status,
      kind: query.kind as Report['kind'] | undefined,
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' } } : {}),
    };

    const sort = resolveSort(SORTABLE, 'createdAt', query.sortBy, query.sortDir);
    const { skip, take } = Paginated.skipTake(query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        orderBy: { [sort.field]: sort.direction },
        skip,
        take,
        include: { sections: { orderBy: { position: 'asc' } } },
      }),
      this.prisma.report.count({ where }),
    ]);

    return Paginated.of(
      rows.map((row) => toReport(row, row.sections)),
      total,
      query,
    );
  }

  async get(userId: string, id: string): Promise<Report> {
    const report = await this.prisma.report.findFirst({
      where: { id, userId },
      include: { sections: { orderBy: { position: 'asc' } } },
    });
    if (!report) throw AppException.notFound('Report not found');
    return toReport(report, report.sections);
  }

  async create(userId: string, input: CreateReportInput): Promise<Report> {
    const report = await this.prisma.report.create({
      data: {
        userId,
        title: input.title ?? DEFAULT_TITLES[input.kind],
        kind: input.kind,
        status: 'queued',
        format: input.format,
        tone: input.tone,
        includeCharts: input.includeCharts,
        target: input.target,
      },
      include: { sections: true },
    });

    try {
      const job = await this.queue.add(
        'generate',
        { reportId: report.id, userId },
        { ...DEFAULT_JOB_OPTIONS, jobId: report.id },
      );
      await this.prisma.report.update({
        where: { id: report.id },
        data: { jobId: job.id ?? null },
      });
    } catch (error) {
      // A queue outage must not lose the request: the row stays `queued` and the
      // scheduled sweeper will pick it up.
      this.logger.warn(
        `Could not enqueue report ${report.id}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }

    return toReport(report, []);
  }

  async remove(userId: string, id: string): Promise<void> {
    const report = await this.prisma.report.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!report) throw AppException.notFound('Report not found');
    await this.prisma.report.delete({ where: { id } });
  }

  /** Re-queue a failed report. */
  async retry(userId: string, id: string): Promise<Report> {
    const report = await this.prisma.report.findFirst({ where: { id, userId } });
    if (!report) throw AppException.notFound('Report not found');
    if (report.status === 'generating')
      throw AppException.conflict('This report is already being generated');

    const updated = await this.prisma.report.update({
      where: { id },
      data: { status: 'queued', error: null, completedAt: null },
      include: { sections: { orderBy: { position: 'asc' } } },
    });
    await this.queue
      .add(
        'generate',
        { reportId: id, userId },
        { ...DEFAULT_JOB_OPTIONS, jobId: `${id}:${Date.now()}` },
      )
      .catch(() => undefined);
    return toReport(updated, updated.sections);
  }

  /** Markdown export used by the download endpoint. */
  async exportMarkdown(userId: string, id: string): Promise<{ filename: string; body: string }> {
    const report = await this.get(userId, id);
    if (report.status !== 'ready') throw AppException.conflict('The report is not ready yet');

    const sections = report.sections
      .map((section) => `## ${section.heading}\n\n${section.body}`)
      .join('\n\n');
    const body = [`# ${report.title}`, report.summary ?? '', report.content ?? '', sections]
      .filter((part) => part.trim().length > 0)
      .join('\n\n');

    return { filename: `${slugify(report.title)}.md`, body };
  }

  // ── Queue-facing operations ────────────────────────────────────────────────

  async markGenerating(reportId: string): Promise<void> {
    await this.prisma.report.update({
      where: { id: reportId },
      data: { status: 'generating', error: null },
    });
  }

  async markReady(
    reportId: string,
    payload: {
      title: string;
      summary: string;
      content: string;
      sections: { heading: string; body: string; charts?: unknown }[];
      tokensUsed: number;
      generationMs: number;
    },
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.reportSection.deleteMany({ where: { reportId } }),
      this.prisma.report.update({
        where: { id: reportId },
        data: {
          status: 'ready',
          title: payload.title,
          summary: payload.summary,
          content: payload.content,
          tokensUsed: payload.tokensUsed,
          generationMs: payload.generationMs,
          completedAt: new Date(),
          error: null,
          sections: {
            create: payload.sections.map((section, index) => ({
              position: index,
              heading: section.heading,
              body: section.body,
              charts: section.charts ?? undefined,
            })),
          },
        },
      }),
    ]);
  }

  async markFailed(reportId: string, reason: string): Promise<void> {
    await this.prisma.report.update({
      where: { id: reportId },
      data: { status: 'failed', error: reason.slice(0, 1000), completedAt: new Date() },
    });
  }

  async findForGeneration(reportId: string): Promise<ReportRow | null> {
    return this.prisma.report.findUnique({ where: { id: reportId } });
  }

  /** Reports stuck in `queued` (queue outage or a lost worker). */
  async findStale(
    olderThanMinutes: number,
    limit: number,
  ): Promise<{ id: string; userId: string }[]> {
    return this.prisma.report.findMany({
      where: {
        status: 'queued',
        createdAt: { lt: new Date(Date.now() - olderThanMinutes * 60_000) },
      },
      select: { id: true, userId: true },
      take: limit,
    });
  }
}

function toReport(row: ReportRow, sections: ReportSectionRow[]): Report {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    kind: row.kind,
    status: row.status,
    content: row.content,
    summary: row.summary,
    target: (row.target ?? {}) as Record<string, unknown>,
    sections: sections.map(toReportSection),
    tokensUsed: row.tokensUsed,
    generationMs: row.generationMs,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

function toReportSection(row: ReportSectionRow): ReportSection {
  return {
    id: row.id,
    heading: row.heading,
    body: row.body,
    charts: (row.charts ?? undefined) as ReportChart[] | undefined,
  };
}

function slugify(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, '-')
      .replace(/^-+|-+$/gu, '')
      .slice(0, 64) || 'report'
  );
}
