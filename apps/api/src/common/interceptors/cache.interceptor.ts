import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { from, of, switchMap, tap, type Observable } from 'rxjs';
import { createHash } from 'node:crypto';
import { RedisService } from 'src/infra/redis/redis.service';
import { CACHE_TTL_KEY, type CacheTtlOptions } from '../decorators/cache-ttl.decorator';

/** Express types `route` as `any`; this is the only field the key builder reads. */
interface MatchedRoute {
  path?: string;
}

/**
 * Query values arrive as strings, arrays or nested objects. Everything is folded
 * into a stable string so the cache key is deterministic and never `[object Object]`.
 */
function serialiseQueryValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (Array.isArray(value)) return value.map((entry) => serialiseQueryValue(entry)).join('|');
  return JSON.stringify(value) ?? '';
}

/**
 * Redis response cache for GET routes annotated with `@CacheTtl()`.
 *
 * Keys include the route, the normalised query string and — for `scope: 'user'`
 * routes — the principal id, so a personalised payload is never served to
 * another caller. A Redis outage simply means every request is a miss.
 */
@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const options = this.reflector.getAllAndOverride<CacheTtlOptions | undefined>(CACHE_TTL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options || options.ttl <= 0) return next.handle();

    const request = context.switchToHttp().getRequest<Request>();
    if (request.method !== 'GET') return next.handle();
    if (request.header('cache-control') === 'no-cache') return next.handle();

    const key = this.buildKey(request, options);

    return from(this.redis.get<unknown>(key)).pipe(
      switchMap((hit) => {
        if (hit) {
          request.cacheHit = true;
          request.cacheAge = hit.ageSeconds;
          return of(hit.value);
        }
        return next.handle().pipe(
          tap((value) => {
            if (value !== undefined) void this.redis.set(key, value, options.ttl);
          }),
        );
      }),
    );
  }

  private buildKey(request: Request, options: CacheTtlOptions): string {
    const route = request.route as MatchedRoute | undefined;
    const base = options.key ?? route?.path ?? request.path;
    const query = Object.entries(request.query as Record<string, unknown>)
      .map(([name, value]) => `${name}=${serialiseQueryValue(value)}`)
      .sort()
      .join('&');
    const params = Object.entries(request.params as Record<string, string>)
      .map(([name, value]) => `${name}:${value}`)
      .sort()
      .join('&');
    const principal = options.scope === 'user' ? (request.user?.id ?? 'anonymous') : 'shared';
    const digest = createHash('sha1').update(`${params}?${query}`).digest('hex').slice(0, 24);
    return `http:${principal}:${base}:${digest}`;
  }
}
