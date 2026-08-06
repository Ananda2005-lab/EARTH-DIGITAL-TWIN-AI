import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  api,
  apiMaybe,
  apiRequest,
  buildQuery,
  describeError,
} from './client';
import type { ApiErrorBody } from '@edt/shared';

describe('buildQuery', () => {
  it('skips nullish and empty values', () => {
    expect(buildQuery({ a: 1, b: null, c: undefined, d: '' })).toBe('?a=1');
  });

  it('joins arrays with commas and stringifies', () => {
    expect(buildQuery({ kinds: ['a', 'b'], flag: true })).toBe('?kinds=a%2Cb&flag=true');
  });

  it('returns an empty string for no params', () => {
    expect(buildQuery({})).toBe('');
  });
});

describe('ApiError', () => {
  it('infers a code from the status when absent', () => {
    expect(new ApiError({ status: 404, message: 'x' }).code).toBe('NOT_FOUND');
    expect(new ApiError({ status: 429, message: 'x' }).code).toBe('RATE_LIMITED');
    expect(new ApiError({ status: 500, message: 'x' }).code).toBe('INTERNAL_ERROR');
  });

  it('exposes semantic helpers', () => {
    const err = new ApiError({ status: 401, message: 'x', code: 'UNAUTHORISED' });
    expect(err.isUnauthorised).toBe(true);
    expect(err.isNotFound).toBe(false);
    expect(err.isUpstream).toBe(false);
    expect(err.requestId).toBeUndefined();
  });
});

describe('apiRequest', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockClear();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('unwraps the envelope and returns data + meta', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { id: 1 }, meta: { page: 1 } }),
    } as Response);

    const result = await apiRequest<{ id: number }>('/users/1');
    expect(result.data).toEqual({ id: 1 });
    expect(result.meta).toEqual({ page: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/users/1'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('returns an empty envelope for 204', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204 } as Response);
    await expect(apiRequest('/x')).resolves.toEqual({ data: undefined, meta: {} });
  });

  it('throws a typed ApiError on a non-ok response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () =>
        ({ code: 'VALIDATION_FAILED', message: 'nope', requestId: 'r-1' }) as ApiErrorBody,
    } as Response);

    const err = await apiRequest('/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(422);
    expect((err as ApiError).code).toBe('VALIDATION_FAILED');
    expect((err as ApiError).requestId).toBe('r-1');
  });

  it('throws when the body is not an envelope', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ unexpected: true }),
    } as Response);
    await expect(apiRequest('/x')).rejects.toThrow('Malformed response');
  });

  it('serialises a JSON body and bearer token', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: null }) } as Response);
    await apiRequest('/login', { method: 'POST', body: { user: 1 }, accessToken: 'tok' });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'content-type': 'application/json' });
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok');
    expect(init.body).toBe(JSON.stringify({ user: 1 }));
  });
});

describe('api / apiMaybe', () => {
  it('api returns just the payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: 7 }) } as Response),
    );
    await expect(api('/n')).resolves.toBe(7);
    vi.unstubAllGlobals();
  });

  it('apiMaybe swallows 404s and returns null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ code: 'NOT_FOUND', message: 'gone' }),
      } as Response),
    );
    await expect(apiMaybe('/nope')).resolves.toBeNull();
    vi.unstubAllGlobals();
  });
});

describe('describeError', () => {
  it('maps known error codes to copy', () => {
    expect(describeError(new ApiError({ status: 401, message: 'x', code: 'UNAUTHORISED' })).title).toBe(
      'Session expired',
    );
    expect(describeError(new ApiError({ status: 503, message: 'x', code: 'UPSTREAM_UNAVAILABLE' })).title).toBe(
      'Data provider unavailable',
    );
  });

  it('falls back for unknown errors', () => {
    expect(describeError(new Error('boom')).description).toBe('boom');
    expect(describeError(null).title).toBe('Something went wrong');
  });
});
