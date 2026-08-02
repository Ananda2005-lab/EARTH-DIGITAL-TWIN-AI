import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { QUEUE_NAMES, type UsageRollupJob } from '../queues';

/**
 * Rolls the previous hour of activity into `usage_metrics`.
 *
 * Requests and errors come from the audit trail, tokens and latency from the AI
 * usage log. Writing one idempotent row per (scope, bucket) means a retry can
 * never double-count.
 */
@Processor(QUEUE_NAMES.usageRollup, { concurrency: 1 })
export class UsageRollupProcessor extends WorkerHost {
  private readonly logger = new Logger(UsageRollupProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<UsageRollupJob>): Promise<{ bucket: string; requests: number }> {
    const bucket = startOfHour(
      job.data.bucket ? new Date(job.data.bucket) : new Date(Date.now() - 3_600_000),
    );
    const nextBucket = new Date(bucket.getTime() + 3_600_000);
    const window = { gte: bucket, lt: nextBucket };

    const [audit, failures, ai, distinctUsers] = await Promise.all([
      this.prisma.auditLog.count({ where: { createdAt: window } }),
      this.prisma.auditLog.count({ where: { createdAt: window, outcome: 'failure' } }),
      this.prisma.aiUsageLog.findMany({
        where: { createdAt: window },
        select: { totalTokens: true, latencyMs: true },
      }),
      this.prisma.aiUsageLog.findMany({
        where: { createdAt: window, userId: { not: null } },
        distinct: ['userId'],
        select: { userId: true },
      }),
    ]);

    const latencies = ai.map((entry) => entry.latencyMs).sort((a, b) => a - b);
    const p95 =
      latencies.length === 0
        ? 0
        : (latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))] ?? 0);
    const requests = audit + ai.length;

    await this.prisma.usageMetric.upsert({
      where: { scope_bucket: { scope: 'global', bucket } },
      create: {
        scope: 'global',
        bucket,
        requests,
        errors: Math.min(failures, requests),
        p95LatencyMs: p95,
        aiTokens: ai.reduce((total, entry) => total + entry.totalTokens, 0),
        uniqueUsers: distinctUsers.length,
      },
      update: {
        requests,
        errors: Math.min(failures, requests),
        p95LatencyMs: p95,
        aiTokens: ai.reduce((total, entry) => total + entry.totalTokens, 0),
        uniqueUsers: distinctUsers.length,
      },
    });

    this.logger.log(
      `Usage rollup ${bucket.toISOString()}: ${requests} requests, ${distinctUsers.length} users`,
    );
    return { bucket: bucket.toISOString(), requests };
  }
}

function startOfHour(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCMinutes(0, 0, 0);
  return copy;
}
