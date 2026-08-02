/** Envelope returned by every REST endpoint on the NestJS gateway. */
export interface ApiResponse<T> {
  data: T;
  meta?: ApiMeta;
}

export interface ApiMeta {
  requestId?: string;
  cached?: boolean;
  /** Age of the cached payload in seconds. */
  cacheAge?: number;
  attribution?: string;
  tookMs?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ApiErrorBody {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
  details?: unknown;
  path: string;
  requestId: string;
  timestamp: string;
}

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_FAILED'
  | 'UNAUTHORISED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export interface SortSpec {
  field: string;
  direction: 'asc' | 'desc';
}

export interface HealthReport {
  status: 'ok' | 'degraded' | 'down';
  version: string;
  uptimeSeconds: number;
  checks: { name: string; status: 'ok' | 'degraded' | 'down'; latencyMs?: number; detail?: string }[];
  timestamp: string;
}

export interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  /** 0..100 percentage rollout. */
  rollout: number;
  audience: ('free' | 'pro' | 'team' | 'enterprise' | 'internal')[];
  updatedAt: string;
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  /** Only the last four characters are ever returned. */
  suffix: string;
  scopes: string[];
  rateLimitPerMinute: number;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  ip: string | null;
  userAgent: string | null;
  outcome: 'success' | 'failure';
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface UsageMetric {
  bucket: string;
  requests: number;
  errors: number;
  p95LatencyMs: number;
  aiTokens: number;
  uniqueUsers: number;
}
