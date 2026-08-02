import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuditLogEntry, PaginatedResult } from '@edt/shared';
import { Paginated } from 'src/common/pagination';
import { PrismaService } from 'src/infra/prisma/prisma.service';

export interface AuditWriteInput {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  outcome?: 'success' | 'failure';
  metadata?: Record<string, unknown>;
  requestId?: string | null;
}

export interface AuditQuery {
  page: number;
  pageSize: number;
  actorId?: string;
  resource?: string;
  action?: string;
  outcome?: 'success' | 'failure';
  from?: Date;
  to?: Date;
}

const SENSITIVE_KEYS = [
  'password',
  'currentpassword',
  'confirmpassword',
  'token',
  'refreshtoken',
  'accesstoken',
  'secret',
  'apikey',
  'authorization',
  'mfacode',
  'code',
];

/** Recursively strip anything that looks like a credential before persisting. */
export function redactMetadata(input: unknown, depth = 0): unknown {
  if (depth > 6 || input === null || input === undefined) return input;
  if (Array.isArray(input))
    return input.slice(0, 50).map((entry) => redactMetadata(entry, depth + 1));
  if (typeof input === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      result[key] = SENSITIVE_KEYS.includes(key.toLowerCase())
        ? '[redacted]'
        : redactMetadata(value, depth + 1);
    }
    return result;
  }
  if (typeof input === 'string') return input.length > 2000 ? `${input.slice(0, 2000)}…` : input;
  return input;
}

/**
 * Append-only trail of privileged actions. Writes never throw into the request
 * path: an audit failure is logged, not surfaced to the caller.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditWriteInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: input.actorId ?? null,
          actorEmail: input.actorEmail ?? null,
          action: input.action,
          resource: input.resource,
          resourceId: input.resourceId ?? null,
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
          outcome: input.outcome ?? 'success',
          metadata: redactMetadata(input.metadata ?? {}) ?? {},
          requestId: input.requestId ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to persist audit entry ${input.action}: ${(error as Error).message}`,
      );
    }
  }

  async list(query: AuditQuery): Promise<PaginatedResult<AuditLogEntry>> {
    const where: Prisma.AuditLogWhereInput = {
      actorId: query.actorId,
      resource: query.resource,
      action: query.action,
      outcome: query.outcome,
      createdAt:
        query.from || query.to
          ? { gte: query.from ?? undefined, lte: query.to ?? undefined }
          : undefined,
    };

    const { skip, take } = Paginated.skipTake(query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.auditLog.count({ where }),
    ]);

    return Paginated.of(
      rows.map((row) => ({
        id: row.id,
        actorId: row.actorId,
        actorEmail: row.actorEmail,
        action: row.action,
        resource: row.resource,
        resourceId: row.resourceId,
        ip: row.ip,
        userAgent: row.userAgent,
        outcome: row.outcome,
        metadata: (row.metadata ?? {}) as Record<string, unknown>,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      query,
    );
  }
}
