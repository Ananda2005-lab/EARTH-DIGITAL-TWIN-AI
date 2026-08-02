import { Injectable } from '@nestjs/common';
import type { Continent as PrismaContinent, Prisma, SubscriptionPlan, UserRole } from '@prisma/client';
import type { PaginatedResult, Report, UserProfile } from '@edt/shared';
import { AppException } from 'src/common/errors/app-exception';
import { Paginated, resolveSort } from 'src/common/pagination';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { TokenService } from '../auth/token.service';
import { toUserProfile } from '../users/user.mapper';

export interface AdminUserQuery {
  page: number;
  pageSize: number;
  q?: string;
  role?: UserRole;
  plan?: SubscriptionPlan;
  status?: 'active' | 'suspended' | 'unverified';
  sortBy?: string;
  sortDir: 'asc' | 'desc';
}

export interface AdminUserUpdate {
  role?: UserRole;
  plan?: SubscriptionPlan;
  suspended?: boolean;
  note?: string;
}

export interface AdminReportQuery {
  page: number;
  pageSize: number;
  status?: Report['status'];
  userId?: string;
}

export interface AiLogQuery {
  page: number;
  pageSize: number;
  userId?: string;
  flaggedOnly?: boolean;
  from?: Date;
  to?: Date;
}

export interface AiLogEntry {
  id: string;
  userId: string | null;
  userEmail: string | null;
  conversationId: string | null;
  model: string;
  intent: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  ok: boolean;
  errorCode: string | null;
  flagged: boolean;
  createdAt: string;
}

export interface AdminDashboard {
  users: { total: number; active: number; suspended: number; unverified: number; newLast7Days: number };
  plans: { plan: SubscriptionPlan; count: number }[];
  content: { reports: number; workspaces: number; bookmarks: number; conversations: number };
  ai: { requests24h: number; tokens24h: number; failures24h: number; flagged: number };
  hazards: { cached: number; notified: number };
  usage: { bucket: string; requests: number; errors: number; p95LatencyMs: number; aiTokens: number; uniqueUsers: number }[];
}

export interface CountryPatch {
  summary?: string | null;
  capital?: string | null;
  population?: number;
  areaKm2?: number;
  wikipediaUrl?: string | null;
  coatOfArmsUrl?: string | null;
  continent?: PrismaContinent;
}

export interface CityPatch {
  summary?: string | null;
  population?: number;
  metroPopulation?: number | null;
  timezone?: string;
  isCapital?: boolean;
  costOfLivingIndex?: number | null;
  qualityOfLifeIndex?: number | null;
  safetyIndex?: number | null;
  averageAqi?: number | null;
  wikipediaUrl?: string | null;
}

const USER_SORTABLE = ['createdAt', 'lastLoginAt', 'email', 'name'] as const;

/**
 * Administrative read/write surface. Every mutation is audited by the interceptor
 * on the controller, and privilege escalation is constrained: only an owner can
 * grant the owner role.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async listUsers(query: AdminUserQuery): Promise<PaginatedResult<UserProfile & { status: string; suspendedAt: string | null }>> {
    const where: Prisma.UserWhereInput = {
      role: query.role,
      plan: query.plan,
      status: query.status,
      ...(query.q
        ? {
            OR: [
              { email: { contains: query.q, mode: 'insensitive' } },
              { name: { contains: query.q, mode: 'insensitive' } },
              { organisation: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const sort = resolveSort(USER_SORTABLE, 'createdAt', query.sortBy, query.sortDir);
    const { skip, take } = Paginated.skipTake(query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { [sort.field]: sort.direction },
        skip,
        take,
        include: { oauthAccounts: { select: { provider: true } } },
      }),
      this.prisma.user.count({ where }),
    ]);

    return Paginated.of(
      rows.map((row) => ({
        ...toUserProfile(row),
        status: row.status,
        suspendedAt: row.suspendedAt ? row.suspendedAt.toISOString() : null,
      })),
      total,
      query,
    );
  }

  async getUser(id: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { oauthAccounts: { select: { provider: true } } },
    });
    if (!user) throw AppException.notFound('User not found');
    return toUserProfile(user);
  }

  async updateUser(actorRole: UserRole, id: string, patch: AdminUserUpdate): Promise<UserProfile> {
    const target = await this.prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!target) throw AppException.notFound('User not found');

    if (patch.role === 'owner' && actorRole !== 'owner') {
      throw AppException.forbidden('Only an owner can grant the owner role');
    }
    if (target.role === 'owner' && actorRole !== 'owner') {
      throw AppException.forbidden('Only an owner can modify another owner');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        role: patch.role,
        plan: patch.plan,
        ...(patch.suspended === undefined
          ? {}
          : patch.suspended
            ? { status: 'suspended', suspendedAt: new Date(), suspendedReason: patch.note ?? null }
            : { status: 'active', suspendedAt: null, suspendedReason: null }),
      },
      include: { oauthAccounts: { select: { provider: true } } },
    });

    // Suspension or a role change must invalidate live sessions immediately.
    if (patch.suspended === true || patch.role !== undefined) {
      await this.tokens.revokeAllForUser(id, { reason: 'admin_action' });
    }

    return toUserProfile(user);
  }

  async listReports(query: AdminReportQuery): Promise<PaginatedResult<Report & { userEmail: string }>> {
    const where: Prisma.ReportWhereInput = { status: query.status, userId: query.userId };
    const { skip, take } = Paginated.skipTake(query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { sections: { orderBy: { position: 'asc' } }, user: { select: { email: true } } },
      }),
      this.prisma.report.count({ where }),
    ]);

    return Paginated.of(
      rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        userEmail: row.user.email,
        title: row.title,
        kind: row.kind,
        status: row.status,
        content: row.content,
        summary: row.summary,
        target: (row.target ?? {}) as Record<string, unknown>,
        sections: row.sections.map((section) => ({
          id: section.id,
          heading: section.heading,
          body: section.body,
        })),
        tokensUsed: row.tokensUsed,
        generationMs: row.generationMs,
        error: row.error,
        createdAt: row.createdAt.toISOString(),
        completedAt: row.completedAt ? row.completedAt.toISOString() : null,
      })),
      total,
      query,
    );
  }

  async listAiLogs(query: AiLogQuery): Promise<PaginatedResult<AiLogEntry>> {
    const where: Prisma.AiUsageLogWhereInput = {
      userId: query.userId,
      flagged: query.flaggedOnly ? true : undefined,
      createdAt: query.from || query.to ? { gte: query.from, lte: query.to } : undefined,
    };
    const { skip, take } = Paginated.skipTake(query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.aiUsageLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { user: { select: { email: true } } },
      }),
      this.prisma.aiUsageLog.count({ where }),
    ]);

    return Paginated.of(
      rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        userEmail: row.user?.email ?? null,
        conversationId: row.conversationId,
        model: row.model,
        intent: row.intent,
        promptTokens: row.promptTokens,
        completionTokens: row.completionTokens,
        totalTokens: row.totalTokens,
        latencyMs: row.latencyMs,
        ok: row.ok,
        errorCode: row.errorCode,
        flagged: row.flagged,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      query,
    );
  }

  async flagAiLog(id: string, flagged: boolean): Promise<void> {
    const exists = await this.prisma.aiUsageLog.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw AppException.notFound('AI log entry not found');
    await this.prisma.aiUsageLog.update({ where: { id }, data: { flagged } });
  }

  async dashboard(): Promise<AdminDashboard> {
    const dayAgo = new Date(Date.now() - 86_400_000);
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);

    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      unverifiedUsers,
      newUsers,
      plans,
      reports,
      workspaces,
      bookmarks,
      conversations,
      aiAggregate,
      aiFailures,
      aiFlagged,
      hazardsCached,
      hazardsNotified,
      usage,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { status: 'active', deletedAt: null } }),
      this.prisma.user.count({ where: { status: 'suspended' } }),
      this.prisma.user.count({ where: { status: 'unverified' } }),
      this.prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.user.groupBy({ by: ['plan'], _count: { _all: true } }),
      this.prisma.report.count(),
      this.prisma.workspace.count(),
      this.prisma.bookmark.count(),
      this.prisma.conversation.count(),
      this.prisma.aiUsageLog.aggregate({
        where: { createdAt: { gte: dayAgo } },
        _sum: { totalTokens: true },
        _count: { _all: true },
      }),
      this.prisma.aiUsageLog.count({ where: { createdAt: { gte: dayAgo }, ok: false } }),
      this.prisma.aiUsageLog.count({ where: { flagged: true } }),
      this.prisma.hazardEventCache.count(),
      this.prisma.hazardEventCache.count({ where: { notifiedAt: { not: null } } }),
      this.prisma.usageMetric.findMany({ orderBy: { bucket: 'desc' }, take: 48 }),
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        suspended: suspendedUsers,
        unverified: unverifiedUsers,
        newLast7Days: newUsers,
      },
      plans: plans.map((entry) => ({ plan: entry.plan, count: entry._count._all })),
      content: { reports, workspaces, bookmarks, conversations },
      ai: {
        requests24h: aiAggregate._count._all,
        tokens24h: aiAggregate._sum.totalTokens ?? 0,
        failures24h: aiFailures,
        flagged: aiFlagged,
      },
      hazards: { cached: hazardsCached, notified: hazardsNotified },
      usage: usage
        .map((entry) => ({
          bucket: entry.bucket.toISOString(),
          requests: entry.requests,
          errors: entry.errors,
          p95LatencyMs: entry.p95LatencyMs,
          aiTokens: entry.aiTokens,
          uniqueUsers: entry.uniqueUsers,
        }))
        .reverse(),
    };
  }

  async patchCountry(code: string, patch: CountryPatch): Promise<{ code: string; updatedAt: string }> {
    const country = await this.prisma.country.findUnique({ where: { code: code.toUpperCase() }, select: { id: true } });
    if (!country) throw AppException.notFound('Country not found');
    const updated = await this.prisma.country.update({
      where: { id: country.id },
      data: {
        summary: patch.summary === undefined ? undefined : patch.summary,
        capital: patch.capital === undefined ? undefined : patch.capital,
        population: patch.population === undefined ? undefined : BigInt(Math.max(0, Math.floor(patch.population))),
        areaKm2: patch.areaKm2,
        wikipediaUrl: patch.wikipediaUrl === undefined ? undefined : patch.wikipediaUrl,
        coatOfArmsUrl: patch.coatOfArmsUrl === undefined ? undefined : patch.coatOfArmsUrl,
        continent: patch.continent,
      },
      select: { code: true, updatedAt: true },
    });
    return { code: updated.code, updatedAt: updated.updatedAt.toISOString() };
  }

  async patchCity(id: string, patch: CityPatch): Promise<{ id: string; updatedAt: string }> {
    const city = await this.prisma.city.findUnique({ where: { id }, select: { id: true } });
    if (!city) throw AppException.notFound('City not found');
    const updated = await this.prisma.city.update({
      where: { id },
      data: { ...patch },
      select: { id: true, updatedAt: true },
    });
    return { id: updated.id, updatedAt: updated.updatedAt.toISOString() };
  }
}
