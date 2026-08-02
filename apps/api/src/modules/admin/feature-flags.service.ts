import { Injectable } from '@nestjs/common';
import type { FeatureFlag as FeatureFlagRow, FlagAudience } from '@prisma/client';
import type { FeatureFlag, SubscriptionPlan } from '@edt/shared';
import { createHash } from 'node:crypto';
import { AppException } from 'src/common/errors/app-exception';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { RedisService } from 'src/infra/redis/redis.service';

export interface FeatureFlagInput {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  rollout: number;
  audience: FlagAudience[];
}

const CACHE_KEY = 'flags:all';
const CACHE_TTL = 30;

/**
 * Progressive rollout controls.
 *
 * Evaluation is deterministic: hashing `flagKey:userId` into 0..99 means a user
 * either sees a partially rolled-out feature consistently or never, with no
 * server-side state.
 */
@Injectable()
export class FeatureFlagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async list(): Promise<FeatureFlag[]> {
    const cached = await this.redis.get<FeatureFlag[]>(CACHE_KEY);
    if (cached) return cached.value;
    const rows = await this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
    const flags = rows.map(toFeatureFlag);
    await this.redis.set(CACHE_KEY, flags, CACHE_TTL);
    return flags;
  }

  async upsert(input: FeatureFlagInput, actorId: string): Promise<FeatureFlag> {
    const row = await this.prisma.featureFlag.upsert({
      where: { key: input.key },
      create: { ...input, updatedById: actorId },
      update: { ...input, updatedById: actorId },
    });
    await this.redis.del(CACHE_KEY);
    return toFeatureFlag(row);
  }

  async remove(key: string): Promise<void> {
    const existing = await this.prisma.featureFlag.findUnique({ where: { key }, select: { id: true } });
    if (!existing) throw AppException.notFound('Feature flag not found');
    await this.prisma.featureFlag.delete({ where: { key } });
    await this.redis.del(CACHE_KEY);
  }

  /** Effective flag set for one principal, with rollout and audience applied. */
  async evaluate(userId: string | null, plan: SubscriptionPlan | null, isInternal: boolean): Promise<Record<string, boolean>> {
    const flags = await this.list();
    const result: Record<string, boolean> = {};
    for (const flag of flags) {
      result[flag.key] = evaluateFlag(flag, userId, plan, isInternal);
    }
    return result;
  }
}

export function evaluateFlag(
  flag: FeatureFlag,
  userId: string | null,
  plan: SubscriptionPlan | null,
  isInternal: boolean,
): boolean {
  if (!flag.enabled) return false;

  const audienceMatches =
    (isInternal && flag.audience.includes('internal')) ||
    (plan !== null && flag.audience.includes(plan)) ||
    flag.audience.length === 0;
  if (!audienceMatches) return false;

  if (flag.rollout >= 100) return true;
  if (flag.rollout <= 0) return false;
  if (!userId) return false;

  const digest = createHash('sha1').update(`${flag.key}:${userId}`).digest();
  const bucket = ((digest[0] ?? 0) << 8 | (digest[1] ?? 0)) % 100;
  return bucket < flag.rollout;
}

function toFeatureFlag(row: FeatureFlagRow): FeatureFlag {
  return {
    key: row.key,
    label: row.label,
    description: row.description,
    enabled: row.enabled,
    rollout: row.rollout,
    audience: row.audience,
    updatedAt: row.updatedAt.toISOString(),
  };
}
