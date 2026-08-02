import { z } from 'zod';
import { LAYER_IDS } from '../constants/layers';
import {
  bboxSchema,
  countryCodeSchema,
  lngLatSchema,
  paginationSchema,
  sortSchema,
  viewStateSchema,
} from './common';

const layerIdSchema = z.string().refine((id) => LAYER_IDS.includes(id), 'Unknown layer id');

// ── Bookmarks ─────────────────────────────────────────────────────────────────

export const createBookmarkSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullish(),
  kind: z.enum(['place', 'view', 'area', 'route']).default('place'),
  center: lngLatSchema,
  view: viewStateSchema.nullish(),
  bbox: bboxSchema.nullish(),
  countryCode: countryCodeSchema.nullish(),
  tags: z.array(z.string().trim().min(1).max(32)).max(20).default([]),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#38bdf8'),
  collectionId: z.string().uuid().nullish(),
  pinned: z.boolean().default(false),
});

export const updateBookmarkSchema = createBookmarkSchema.partial();

export const listBookmarksSchema = paginationSchema.merge(sortSchema).extend({
  q: z.string().trim().max(120).optional(),
  collectionId: z.string().uuid().optional(),
  tag: z.string().trim().max(32).optional(),
  kind: z.enum(['place', 'view', 'area', 'route']).optional(),
  pinnedOnly: z.coerce.boolean().optional(),
});

export const createCollectionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).nullish(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#818cf8'),
});

// ── Workspaces ────────────────────────────────────────────────────────────────

export const annotationSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(['marker', 'line', 'polygon', 'circle', 'text', 'measure']),
  label: z.string().trim().max(160).default(''),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#22d3ee'),
  coordinates: z.array(lngLatSchema).min(1).max(2000),
  radiusM: z.number().positive().max(20_000_000).optional(),
  notes: z.string().max(4000).optional(),
});

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullish(),
  view: viewStateSchema,
  layers: z.array(layerIdSchema).max(40).default([]),
  annotations: z.array(annotationSchema).max(500).default([]),
  visibility: z.enum(['private', 'team', 'public']).default('private'),
});

export const updateWorkspaceSchema = createWorkspaceSchema.partial();

// ── Reports ───────────────────────────────────────────────────────────────────

export const createReportSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  kind: z.enum([
    'country_profile',
    'city_profile',
    'area_summary',
    'environmental_risk',
    'climate_outlook',
    'comparison',
    'travel_plan',
    'custom',
  ]),
  target: z
    .object({
      countryCode: countryCodeSchema.optional(),
      cityId: z.string().max(64).optional(),
      bbox: bboxSchema.optional(),
      center: lngLatSchema.optional(),
      compareWith: z.array(z.string().max(64)).max(6).optional(),
      prompt: z.string().trim().max(4000).optional(),
      horizonYears: z.number().int().min(1).max(80).optional(),
    })
    .refine(
      (t) => Boolean(t.countryCode || t.cityId || t.bbox || t.center || t.prompt),
      'Provide at least one target: country, city, area, coordinate or prompt',
    ),
  format: z.enum(['markdown', 'pdf', 'docx']).default('markdown'),
  includeCharts: z.boolean().default(true),
  tone: z.enum(['executive', 'technical', 'academic', 'casual']).default('executive'),
});

export const listReportsSchema = paginationSchema.merge(sortSchema).extend({
  status: z.enum(['queued', 'generating', 'ready', 'failed']).optional(),
  kind: z.string().max(48).optional(),
  q: z.string().trim().max(120).optional(),
});

// ── Notifications ─────────────────────────────────────────────────────────────

export const listNotificationsSchema = paginationSchema.extend({
  unreadOnly: z.coerce.boolean().default(false),
  kind: z.enum(['hazard', 'report', 'system', 'ai', 'billing', 'security']).optional(),
});

export const broadcastNotificationSchema = z.object({
  kind: z.enum(['hazard', 'report', 'system', 'ai', 'billing', 'security']).default('system'),
  severity: z.enum(['info', 'success', 'warning', 'critical']).default('info'),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(2000),
  actionUrl: z.string().url().max(512).nullish(),
  audience: z.enum(['all', 'free', 'pro', 'team', 'enterprise', 'admins']).default('all'),
  scheduledFor: z.string().datetime().nullish(),
});

// ── Hazards / feeds ───────────────────────────────────────────────────────────

export const hazardQuerySchema = z.object({
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
    )
    .pipe(
      z
        .array(
          z.enum([
            'earthquake',
            'wildfire',
            'volcano',
            'flood',
            'cyclone',
            'drought',
            'landslide',
            'tsunami',
          ]),
        )
        .optional(),
    ),
  bbox: z.string().optional(),
  minMagnitude: z.coerce.number().min(0).max(10).optional(),
  minSeverity: z.enum(['info', 'low', 'moderate', 'high', 'extreme']).optional(),
  hours: z.coerce.number().int().min(1).max(720).default(24),
  limit: z.coerce.number().int().min(1).max(2000).default(500),
});

export const flightQuerySchema = z.object({
  bbox: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(4000).default(1500),
  onGround: z.coerce.boolean().optional(),
  minAltitude: z.coerce.number().min(-500).max(30_000).optional(),
  callsign: z.string().trim().max(12).optional(),
});

export const shipQuerySchema = z.object({
  bbox: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(4000).default(1000),
  kinds: z.string().optional(),
  minSog: z.coerce.number().min(0).max(60).optional(),
});

// ── Analytics ─────────────────────────────────────────────────────────────────

export const indicatorQuerySchema = z.object({
  indicator: z.string().min(2).max(64),
  countries: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(',')
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean)
        : undefined,
    ),
  from: z.coerce.number().int().min(1900).max(2100).optional(),
  to: z.coerce.number().int().min(1900).max(2100).optional(),
  limit: z.coerce.number().int().min(1).max(300).default(60),
});

export const rankingQuerySchema = z.object({
  indicator: z.string().min(2).max(64),
  direction: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(250).default(20),
  continent: z.string().max(32).optional(),
});

export const correlationQuerySchema = z.object({
  x: z.string().min(2).max(64),
  y: z.string().min(2).max(64),
  continent: z.string().max(32).optional(),
});

// ── AI ────────────────────────────────────────────────────────────────────────

export const mapContextSchema = z.object({
  view: viewStateSchema,
  bbox: bboxSchema.nullish(),
  activeLayers: z.array(z.string().max(48)).max(40).default([]),
  basemap: z.string().max(48).default('satellite'),
  focus: z
    .object({
      kind: z.enum(['country', 'city', 'coordinate', 'area', 'none']).default('none'),
      label: z.string().max(160).nullish(),
      countryCode: countryCodeSchema.nullish(),
      cityId: z.string().max(64).nullish(),
      center: lngLatSchema.nullish(),
    })
    .default({ kind: 'none', label: null, countryCode: null, cityId: null, center: null }),
  visibleHazardCount: z.number().int().min(0).max(100_000).default(0),
  localTime: z.string().max(64).nullish(),
  units: z.enum(['metric', 'imperial']).default('metric'),
});

export const aiChatSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1, 'Ask something').max(8000),
  context: mapContextSchema.nullish(),
  stream: z.boolean().default(false),
  intentHint: z.string().max(48).optional(),
});

export const aiCompareSchema = z.object({
  targets: z
    .array(z.object({ kind: z.enum(['country', 'city']), id: z.string().min(1).max(64) }))
    .min(2)
    .max(6),
  dimensions: z.array(z.string().min(2).max(64)).max(20).optional(),
});

export const aiTravelPlanSchema = z.object({
  destination: z.string().trim().min(2).max(160),
  origin: z.string().trim().max(160).optional(),
  days: z.number().int().min(1).max(60).default(7),
  travellers: z.number().int().min(1).max(20).default(2),
  budget: z.enum(['shoestring', 'moderate', 'comfortable', 'luxury']).default('moderate'),
  interests: z.array(z.string().min(2).max(40)).max(12).default([]),
  month: z.number().int().min(1).max(12).optional(),
  accessibility: z.boolean().default(false),
});

// ── Admin ─────────────────────────────────────────────────────────────────────

export const adminListUsersSchema = paginationSchema.merge(sortSchema).extend({
  q: z.string().trim().max(120).optional(),
  role: z.enum(['user', 'analyst', 'admin', 'owner']).optional(),
  plan: z.enum(['free', 'pro', 'team', 'enterprise']).optional(),
  status: z.enum(['active', 'suspended', 'unverified']).optional(),
});

export const adminUpdateUserSchema = z.object({
  role: z.enum(['user', 'analyst', 'admin', 'owner']).optional(),
  plan: z.enum(['free', 'pro', 'team', 'enterprise']).optional(),
  suspended: z.boolean().optional(),
  note: z.string().max(1000).optional(),
});

export const featureFlagSchema = z.object({
  key: z.string().regex(/^[a-z0-9_.-]{3,64}$/),
  label: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).default(''),
  enabled: z.boolean().default(false),
  rollout: z.number().int().min(0).max(100).default(0),
  audience: z
    .array(z.enum(['free', 'pro', 'team', 'enterprise', 'internal']))
    .default(['internal']),
});

export const createApiKeySchema = z.object({
  name: z.string().trim().min(2).max(80),
  scopes: z.array(z.string().min(2).max(48)).min(1).max(30),
  rateLimitPerMinute: z.number().int().min(1).max(10_000).default(120),
  expiresInDays: z.number().int().min(1).max(3650).nullish(),
});

export type CreateBookmarkInput = z.infer<typeof createBookmarkSchema>;
export type CreateReportInput = z.infer<typeof createReportSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type AiChatInput = z.infer<typeof aiChatSchema>;
export type AiTravelPlanInput = z.infer<typeof aiTravelPlanSchema>;
export type HazardQueryInput = z.infer<typeof hazardQuerySchema>;
export type FlightQueryInput = z.infer<typeof flightQuerySchema>;
export type ShipQueryInput = z.infer<typeof shipQuerySchema>;
