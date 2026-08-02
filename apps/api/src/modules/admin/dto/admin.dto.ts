import type { Continent } from '@prisma/client';
import { z } from 'zod';
import {
  adminListUsersSchema,
  adminUpdateUserSchema,
  broadcastNotificationSchema,
  createApiKeySchema,
  featureFlagSchema,
  paginationSchema,
} from '@edt/shared';
import { zodDto } from 'src/common/zod/zod-dto';

/**
 * Admins send the human-readable continent label; Prisma stores the enum member.
 * The map keeps the public contract friendly while satisfying `Continent`.
 */
const CONTINENT_LABELS = {
  Africa: 'AFRICA',
  Antarctica: 'ANTARCTICA',
  Asia: 'ASIA',
  Europe: 'EUROPE',
  'North America': 'NORTH_AMERICA',
  Oceania: 'OCEANIA',
  'South America': 'SOUTH_AMERICA',
} as const satisfies Record<string, Continent>;

const CONTINENTS = Object.keys(CONTINENT_LABELS) as [
  keyof typeof CONTINENT_LABELS,
  ...(keyof typeof CONTINENT_LABELS)[],
];

export const adminReportQuerySchema = paginationSchema.extend({
  status: z.enum(['queued', 'generating', 'ready', 'failed']).optional(),
  userId: z.string().uuid().optional(),
});

export const aiLogQuerySchema = paginationSchema.extend({
  userId: z.string().uuid().optional(),
  flaggedOnly: z.coerce.boolean().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const auditQuerySchema = paginationSchema.extend({
  actorId: z.string().uuid().optional(),
  resource: z.string().trim().max(64).optional(),
  action: z.string().trim().max(64).optional(),
  outcome: z.enum(['success', 'failure']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const flagAiLogSchema = z.object({ flagged: z.boolean() });

export const patchCountrySchema = z.object({
  summary: z.string().trim().max(4000).nullish(),
  capital: z.string().trim().max(120).nullish(),
  population: z.number().int().min(0).max(3_000_000_000).optional(),
  areaKm2: z.number().min(0).max(20_000_000).optional(),
  wikipediaUrl: z.string().url().max(512).nullish(),
  coatOfArmsUrl: z.string().url().max(512).nullish(),
  continent: z
    .enum(CONTINENTS)
    .transform((label) => CONTINENT_LABELS[label])
    .optional(),
});

export const patchCitySchema = z.object({
  summary: z.string().trim().max(4000).nullish(),
  population: z.number().int().min(0).max(100_000_000).optional(),
  metroPopulation: z.number().int().min(0).max(100_000_000).nullish(),
  timezone: z.string().trim().min(2).max(64).optional(),
  isCapital: z.boolean().optional(),
  costOfLivingIndex: z.number().min(0).max(500).nullish(),
  qualityOfLifeIndex: z.number().min(0).max(500).nullish(),
  safetyIndex: z.number().min(0).max(500).nullish(),
  averageAqi: z.number().min(0).max(1000).nullish(),
  wikipediaUrl: z.string().url().max(512).nullish(),
});

export const maintenanceSchema = z.object({
  enabled: z.boolean(),
  message: z.string().trim().max(500).nullish(),
});

export const invalidateCacheSchema = z.object({
  pattern: z.string().trim().min(1).max(120).optional(),
  provider: z.string().trim().min(2).max(48).optional(),
});

export const listApiKeysSchema = z.object({ includeRevoked: z.coerce.boolean().default(false) });

export class AdminListUsersDto extends zodDto(adminListUsersSchema) {}
export class AdminUpdateUserDto extends zodDto(adminUpdateUserSchema) {}
export class AdminReportQueryDto extends zodDto(adminReportQuerySchema) {}
export class AiLogQueryDto extends zodDto(aiLogQuerySchema) {}
export class AuditQueryDto extends zodDto(auditQuerySchema) {}
export class FlagAiLogDto extends zodDto(flagAiLogSchema) {}
export class PatchCountryDto extends zodDto(patchCountrySchema) {}
export class PatchCityDto extends zodDto(patchCitySchema) {}
export class FeatureFlagDto extends zodDto(featureFlagSchema) {}
export class BroadcastDto extends zodDto(broadcastNotificationSchema) {}
export class CreateApiKeyDto extends zodDto(createApiKeySchema) {}
export class ListApiKeysDto extends zodDto(listApiKeysSchema) {}
export class MaintenanceDto extends zodDto(maintenanceSchema) {}
export class InvalidateCacheDto extends zodDto(invalidateCacheSchema) {}
