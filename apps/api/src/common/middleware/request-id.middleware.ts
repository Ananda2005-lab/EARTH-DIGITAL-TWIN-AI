import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

const UUID_LIKE = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Assigns (or adopts) a correlation id for every request and starts the latency
 * clock used by `TransformInterceptor`. Inbound ids are accepted only when they
 * look like an id, so a hostile header cannot inject log noise.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const inbound = request.header(REQUEST_ID_HEADER);
    request.requestId = inbound && UUID_LIKE.test(inbound) ? inbound : randomUUID();
    request.startedAt = Date.now();
    response.setHeader(REQUEST_ID_HEADER, request.requestId);
    next();
  }
}
