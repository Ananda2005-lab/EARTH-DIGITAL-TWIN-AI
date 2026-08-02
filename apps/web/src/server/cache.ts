/**
 * Process-local TTL cache with single-flight de-duplication.
 *
 * Next's data cache handles HTTP-level caching, but derived/aggregated payloads
 * (hazard fusion, analytics rollups) are expensive to recompute, and several
 * concurrent requests would otherwise stampede the same upstream. This keeps a
 * bounded LRU in front of them. In a multi-instance deployment Redis behind the
 * NestJS gateway is the shared tier; this is the per-instance hot tier.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
  hits: number;
}

const MAX_ENTRIES = 512;
const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key) as Entry<T> | undefined;
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return undefined;
  }
  entry.hits += 1;
  // Refresh recency for the LRU eviction order.
  store.delete(key);
  store.set(key, entry as Entry<unknown>);
  return entry.value;
}

export function cacheSet<T>(key: string, value: T, ttlSeconds: number): T {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000, hits: 0 });
  return value;
}

/** Memoise an async producer for `ttlSeconds`, collapsing concurrent callers. */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  producer: () => Promise<T>,
): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = producer()
    .then((value) => {
      cacheSet(key, value, ttlSeconds);
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

/** Stale-while-revalidate: return the stale value instantly, refresh in background. */
export async function cachedSwr<T>(
  key: string,
  ttlSeconds: number,
  staleSeconds: number,
  producer: () => Promise<T>,
): Promise<T> {
  const entry = store.get(key) as Entry<T> | undefined;
  const now = Date.now();
  if (entry && entry.expiresAt > now) return entry.value;
  if (entry && entry.expiresAt + staleSeconds * 1000 > now) {
    if (!inflight.has(key)) {
      const refresh = producer()
        .then((value) => cacheSet(key, value, ttlSeconds))
        .catch(() => entry.value)
        .finally(() => inflight.delete(key));
      inflight.set(key, refresh);
    }
    return entry.value;
  }
  return cached(key, ttlSeconds, producer);
}

export function cacheInvalidate(prefix: string): number {
  let removed = 0;
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      removed += 1;
    }
  }
  return removed;
}

export function cacheStats() {
  let hits = 0;
  for (const entry of store.values()) hits += entry.hits;
  return { entries: store.size, maxEntries: MAX_ENTRIES, hits, inflight: inflight.size };
}

/** Deterministic cache key from a route name and params. */
export function cacheKey(namespace: string, params: Record<string, unknown> = {}): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('|') : String(v)}`);
  return parts.length > 0 ? `${namespace}?${parts.join('&')}` : namespace;
}
