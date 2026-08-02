import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { HistoryEntry, PaginatedResult, UpdateProfileInput, UserProfile } from '@edt/shared';
import { AppException } from 'src/common/errors/app-exception';
import { Paginated } from 'src/common/pagination';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { TokenService } from '../auth/token.service';
import { toUserProfile } from './user.mapper';

export interface HistoryQuery {
  page: number;
  pageSize: number;
  kind?: HistoryEntry['kind'];
  q?: string;
}

export interface RecordHistoryInput {
  kind: HistoryEntry['kind'];
  label: string;
  detail?: string | null;
  center?: { lng: number; lat: number } | null;
  metadata?: Record<string, unknown>;
}

const USER_INCLUDE = { oauthAccounts: { select: { provider: true } } } satisfies Prisma.UserInclude;

/** Profile, activity history and account closure for the signed-in user. */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async profile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: USER_INCLUDE });
    if (!user || user.deletedAt) throw AppException.notFound('User not found');
    return toUserProfile(user);
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: input.name,
        avatarUrl: input.avatarUrl ?? undefined,
        organisation: input.organisation ?? undefined,
        jobTitle: input.jobTitle ?? undefined,
        locale: input.locale,
        timezone: input.timezone,
      },
      include: USER_INCLUDE,
    });
    return toUserProfile(user);
  }

  async touchLastSeen(userId: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
  }

  async history(userId: string, query: HistoryQuery): Promise<PaginatedResult<HistoryEntry>> {
    const where: Prisma.HistoryEntryWhereInput = {
      userId,
      kind: query.kind,
      label: query.q ? { contains: query.q, mode: 'insensitive' } : undefined,
    };
    const { skip, take } = Paginated.skipTake(query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.historyEntry.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.historyEntry.count({ where }),
    ]);

    return Paginated.of(
      rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        kind: row.kind,
        label: row.label,
        detail: row.detail,
        center: row.lng !== null && row.lat !== null ? { lng: row.lng, lat: row.lat } : null,
        metadata: (row.metadata ?? {}) as Record<string, unknown>,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      query,
    );
  }

  async recordHistory(userId: string, input: RecordHistoryInput): Promise<void> {
    await this.prisma.historyEntry.create({
      data: {
        userId,
        kind: input.kind,
        label: input.label.slice(0, 400),
        detail: input.detail ?? null,
        lng: input.center?.lng ?? null,
        lat: input.center?.lat ?? null,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async clearHistory(userId: string, kind?: HistoryEntry['kind']): Promise<number> {
    const result = await this.prisma.historyEntry.deleteMany({ where: { userId, kind } });
    return result.count;
  }

  /**
   * Soft-close the account: the row is retained (audit integrity, foreign keys)
   * but anonymised, credentials are destroyed and every session is revoked.
   */
  async closeAccount(userId: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.role === 'owner') throw AppException.forbidden('The platform owner account cannot be closed');

    await this.tokens.revokeAllForUser(userId, { reason: 'account_closed' });
    await this.prisma.$transaction([
      this.prisma.oAuthAccount.deleteMany({ where: { userId } }),
      this.prisma.mfaSecret.deleteMany({ where: { userId } }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          status: 'suspended',
          passwordHash: null,
          mfaEnabled: false,
          email: `deleted+${userId}@earthdigitaltwin.invalid`,
          name: 'Deleted user',
          avatarUrl: null,
          organisation: null,
          jobTitle: null,
        },
      }),
    ]);
  }
}
