import {
  Injectable,
  StreamableFile,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { map, type Observable } from 'rxjs';
import type { ApiMeta, ApiResponse } from '@edt/shared';
import { RAW_RESPONSE_KEY } from '../decorators/raw-response.decorator';
import { ATTRIBUTION_KEY } from '../decorators/attribution.decorator';

/**
 * Wraps every handler result in the `ApiResponse<T>` envelope with request meta.
 * Streams, files and routes marked `@RawResponse()` pass through untouched.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T> | T> {
    if (context.getType() !== 'http') return next.handle();

    const raw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (raw) return next.handle();

    const attribution = this.reflector.getAllAndOverride<string>(ATTRIBUTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        if (data instanceof StreamableFile || Buffer.isBuffer(data) || data === undefined)
          return data;
        const contentType = response.getHeader('content-type');
        if (typeof contentType === 'string' && contentType.includes('text/event-stream'))
          return data;

        const meta: ApiMeta = {
          requestId: request.requestId,
          tookMs: Math.max(0, Date.now() - (request.startedAt ?? Date.now())),
          cached: request.cacheHit === true,
        };
        if (request.cacheHit === true && typeof request.cacheAge === 'number') {
          meta.cacheAge = request.cacheAge;
        }
        if (attribution) meta.attribution = attribution;

        return { data, meta } satisfies ApiResponse<T>;
      }),
    );
  }
}
