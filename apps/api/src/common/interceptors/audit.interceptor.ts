import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { catchError, tap, throwError, type Observable } from 'rxjs';
import { AuditService } from 'src/infra/audit/audit.service';
import { AUDIT_KEY, type AuditOptions } from '../decorators/audit.decorator';

/**
 * Writes an audit entry for routes decorated with `@Audit(...)`, capturing both
 * successes and failures. Request bodies are redacted by `AuditService`.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.get<AuditOptions | undefined>(AUDIT_KEY, context.getHandler());
    if (!options || context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<Request>();
    const params = request.params as Record<string, string | undefined>;
    const resourceId = options.idParam ? (params[options.idParam] ?? null) : null;
    const body = this.pickBody(request.body, options.redact);

    return next.handle().pipe(
      tap(() => {
        void this.audit.record({
          actorId: request.user?.id ?? null,
          actorEmail: request.user?.email ?? null,
          action: options.action,
          resource: options.resource,
          resourceId,
          ip: request.ip ?? null,
          userAgent: request.header('user-agent') ?? null,
          outcome: 'success',
          metadata: { method: request.method, path: request.originalUrl, body },
          requestId: request.requestId,
        });
      }),
      catchError((error: unknown) => {
        void this.audit.record({
          actorId: request.user?.id ?? null,
          actorEmail: request.user?.email ?? null,
          action: options.action,
          resource: options.resource,
          resourceId,
          ip: request.ip ?? null,
          userAgent: request.header('user-agent') ?? null,
          outcome: 'failure',
          metadata: {
            method: request.method,
            path: request.originalUrl,
            body,
            error: error instanceof Error ? error.message : 'unknown error',
          },
          requestId: request.requestId,
        });
        return throwError(() => error);
      }),
    );
  }

  private pickBody(body: unknown, redact?: string[]): Record<string, unknown> | undefined {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
    const entries = Object.entries(body as Record<string, unknown>).filter(
      ([key]) => !(redact ?? []).includes(key),
    );
    return Object.fromEntries(entries);
  }
}
