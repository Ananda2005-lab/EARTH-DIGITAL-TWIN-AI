import { z } from 'zod';
import { paginationSchema, updateProfileSchema } from '@edt/shared';
import { zodDto } from 'src/common/zod/zod-dto';

export const historyQuerySchema = paginationSchema.extend({
  kind: z.enum(['search', 'place', 'report', 'ai', 'layer']).optional(),
  q: z.string().trim().max(160).optional(),
});

export const recordHistorySchema = z.object({
  kind: z.enum(['search', 'place', 'report', 'ai', 'layer']),
  label: z.string().trim().min(1).max(400),
  detail: z.string().trim().max(2000).nullish(),
  center: z.object({ lng: z.number().min(-180).max(180), lat: z.number().min(-90).max(90) }).nullish(),
  metadata: z.record(z.unknown()).default({}),
});

export const clearHistorySchema = z.object({
  kind: z.enum(['search', 'place', 'report', 'ai', 'layer']).optional(),
});

export class UpdateProfileDto extends zodDto(updateProfileSchema) {}
export class HistoryQueryDto extends zodDto(historyQuerySchema) {}
export class RecordHistoryDto extends zodDto(recordHistorySchema) {}
export class ClearHistoryDto extends zodDto(clearHistorySchema) {}
