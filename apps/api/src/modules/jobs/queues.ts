import type { HazardEvent } from '@edt/shared';

/** Queue names. Kept in one place so producers and processors cannot drift. */
export const QUEUE_NAMES = {
  reports: 'reports',
  hazardAlerts: 'hazard-alerts',
  cacheWarm: 'cache-warm',
  usageRollup: 'usage-rollup',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface GenerateReportJob {
  reportId: string;
  userId: string;
}

export interface HazardFanOutJob {
  /** When omitted the processor syncs the hazard cache and fans out new events. */
  events?: HazardEvent[];
  hours?: number;
}

export interface CacheWarmJob {
  /** Optional explicit targets; defaults to the platform's busiest places. */
  countryCodes?: string[];
}

export interface UsageRollupJob {
  /** ISO timestamp of the hour to roll up; defaults to the previous hour. */
  bucket?: string;
}

export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: { age: 3600, count: 500 },
  removeOnFail: { age: 86_400, count: 500 },
};
