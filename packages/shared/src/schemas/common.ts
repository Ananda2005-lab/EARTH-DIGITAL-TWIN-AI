import { z } from 'zod';

export const lngLatSchema = z.object({
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
});

export const bboxSchema = z
  .tuple([
    z.number().min(-180).max(180),
    z.number().min(-90).max(90),
    z.number().min(-180).max(180),
    z.number().min(-90).max(90),
  ])
  .refine((b) => b[1] <= b[3], { message: 'south must be <= north' });

/** Comma separated bbox: "west,south,east,north". */
export const bboxStringSchema = z
  .string()
  .transform((value, ctx) => {
    const parts = value.split(',').map((v) => Number.parseFloat(v.trim()));
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'bbox must be "west,south,east,north"',
      });
      return z.NEVER;
    }
    return parts as [number, number, number, number];
  })
  .pipe(bboxSchema);

export const viewStateSchema = z.object({
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
  altitude: z.number().positive().max(80_000_000),
  bearing: z.number().min(-360).max(360).default(0),
  pitch: z.number().min(0).max(89).default(0),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(24),
});

export const sortSchema = z.object({
  sortBy: z.string().min(1).max(48).optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export const idSchema = z.string().uuid();

export const countryCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/, 'Expected an ISO 3166-1 alpha-2 code')
  .transform((v) => v.toUpperCase());

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(160),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  kinds: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
    ),
  near: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined;
      const [lng, lat] = v.split(',').map((n) => Number.parseFloat(n));
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'near must be "lng,lat"' });
        return z.NEVER;
      }
      return { lng: lng as number, lat: lat as number };
    }),
});

export const unitsSchema = z.enum(['metric', 'imperial']).default('metric');

export const pointQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  units: unitsSchema.optional(),
  timezone: z.string().max(64).optional(),
});

export type PointQuery = z.infer<typeof pointQuerySchema>;
export type PaginationQuery = z.infer<typeof paginationSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
