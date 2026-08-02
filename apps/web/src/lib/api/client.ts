import type { ApiErrorBody, ApiErrorCode, ApiMeta, ApiResponse } from '@edt/shared';

/**
 * Client for the NestJS gateway.
 *
 * Every endpoint answers with `{ data, meta }` on success and `ApiErrorBody` on
 * failure, so this unwraps the envelope and rethrows failures as a typed error
 * the UI can branch on by `code` rather than by message text.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(body: Partial<ApiErrorBody> & { status: number; message: string }) {
    super(body.message);
    this.name = 'ApiError';
    this.status = body.status;
    this.code = body.code ?? codeForStatus(body.status);
    this.details = body.details;
    this.requestId = body.requestId;
  }

  /** Session expired or absent — the caller should redirect to sign-in. */
  get isUnauthorised(): boolean {
    return this.code === 'UNAUTHORISED';
  }

  get isNotFound(): boolean {
    return this.code === 'NOT_FOUND';
  }

  /** A provider is down rather than the request being wrong; retrying may work. */
  get isUpstream(): boolean {
    return this.code === 'UPSTREAM_UNAVAILABLE';
  }
}

function codeForStatus(status: number): ApiErrorCode {
  if (status === 400) return 'BAD_REQUEST';
  if (status === 401) return 'UNAUTHORISED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 422) return 'VALIDATION_FAILED';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 503) return 'UPSTREAM_UNAVAILABLE';
  return 'INTERNAL_ERROR';
}

export type QueryParams = Record<
  string,
  string | number | boolean | null | undefined | (string | number)[]
>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  query?: QueryParams;
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Seconds for the Next.js server data cache. Ignored in the browser. */
  revalidate?: number;
  /** Bearer token for server-side calls, where cookies are not forwarded. */
  accessToken?: string;
}

export interface Result<T> {
  data: T;
  meta: ApiMeta;
}

/**
 * In the browser the relative `/api` prefix is used so requests travel through
 * the Next.js route handlers (same origin, no CORS, cookies attached). On the
 * server the gateway is called directly.
 */
function resolveBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL ?? '/api';
  }
  return process.env.API_BASE_URL ?? 'http://localhost:4000/api/v1';
}

export function buildQuery(params: QueryParams = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length > 0) search.set(key, value.join(','));
      continue;
    }
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

/** Full request returning both payload and envelope metadata. */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<Result<T>> {
  const { method = 'GET', query, body, signal, headers = {}, revalidate, accessToken } = options;

  const url = `${resolveBaseUrl()}${path.startsWith('/') ? path : `/${path}`}${buildQuery(query)}`;

  const response = await fetch(url, {
    method,
    headers: {
      accept: 'application/json',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    credentials: 'include',
    ...(typeof window === 'undefined' && revalidate !== undefined
      ? { next: { revalidate } }
      : { cache: 'no-store' as RequestCache }),
  });

  if (response.status === 204) {
    return { data: undefined as T, meta: {} };
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const errorBody = isErrorBody(payload) ? payload : undefined;
    throw new ApiError({
      status: response.status,
      message: errorBody?.message ?? `Request to ${path} failed with ${response.status}`,
      code: errorBody?.code,
      details: errorBody?.details,
      requestId: errorBody?.requestId,
    });
  }

  const envelope = payload as ApiResponse<T> | null;
  if (!envelope || !('data' in envelope)) {
    throw new ApiError({
      status: 502,
      message: `Malformed response from ${path}`,
      code: 'INTERNAL_ERROR',
    });
  }

  return { data: envelope.data, meta: envelope.meta ?? {} };
}

/** Payload-only convenience wrapper, which is what most callers want. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const result = await apiRequest<T>(path, options);
  return result.data;
}

/** Returns `null` on 404 instead of throwing, for optional resources. */
export async function apiMaybe<T>(path: string, options: RequestOptions = {}): Promise<T | null> {
  try {
    return await api<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) return null;
    throw error;
  }
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    typeof (value as ApiErrorBody).message === 'string'
  );
}

/** Human-readable copy for an error, used by toasts and error boundaries. */
export function describeError(error: unknown): { title: string; description: string } {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'UNAUTHORISED':
        return { title: 'Session expired', description: 'Sign in again to continue.' };
      case 'FORBIDDEN':
        return {
          title: 'Not permitted',
          description: 'Your account does not have access to this.',
        };
      case 'NOT_FOUND':
        return { title: 'Not found', description: 'That resource no longer exists.' };
      case 'RATE_LIMITED':
        return { title: 'Slow down', description: 'Too many requests. Try again shortly.' };
      case 'UPSTREAM_UNAVAILABLE':
        return {
          title: 'Data provider unavailable',
          description: 'The upstream feed is down. Showing what we have.',
        };
      case 'VALIDATION_FAILED':
        return { title: 'Check your input', description: error.message };
      default:
        return { title: 'Something went wrong', description: error.message };
    }
  }
  return {
    title: 'Something went wrong',
    description: error instanceof Error ? error.message : 'Unexpected error.',
  };
}
