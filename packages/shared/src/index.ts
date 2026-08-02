/**
 * @edt/shared — the single source of truth for domain contracts.
 *
 * Consumed by the Next.js client, the NestJS gateway and (via generated JSON
 * schema) the FastAPI AI service, so a contract change never silently drifts.
 */

export * from './types/geo';
export * from './types/weather';
export * from './types/hazard';
export * from './types/transport';
export * from './types/place';
export * from './types/user';
export * from './types/ai';
export * from './types/api';

export * from './constants/layers';
export * from './constants/navigation';
export * from './constants/scales';

export * from './utils/geo';
export * from './utils/format';
export * from './utils/color';

export * from './schemas/common';
export * from './schemas/auth';
export * from './schemas/domain';

export const PLATFORM = {
  name: 'Earth Digital Twin AI',
  shortName: 'Earth Twin',
  tagline: 'A living, queryable replica of the planet',
  version: '1.0.0',
  supportEmail: 'support@earthdigitaltwin.ai',
} as const;
