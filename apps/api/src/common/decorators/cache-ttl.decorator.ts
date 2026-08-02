import { SetMetadata } from '@nestjs/common';

export const CACHE_TTL_KEY = 'edt:cache-ttl';

export interface CacheTtlOptions {
  /** Time to live in seconds. */
  ttl: number;
  /** `user` keys the entry by principal id; `global` shares it across callers. */
  scope?: 'global' | 'user';
  /** Optional stable key prefix; defaults to the route path. */
  key?: string;
}

/**
 * Marks a GET route as cacheable in Redis for `ttl` seconds.
 * `@CacheTtl(300)` or `@CacheTtl({ ttl: 60, scope: 'user' })`.
 */
export const CacheTtl = (options: number | CacheTtlOptions): MethodDecorator & ClassDecorator =>
  SetMetadata(
    CACHE_TTL_KEY,
    typeof options === 'number' ? { ttl: options, scope: 'global' } : options,
  );
