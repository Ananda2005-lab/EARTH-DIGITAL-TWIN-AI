import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiErrorCode } from '@edt/shared';

/**
 * Domain exception carrying the machine-readable `ApiErrorCode` from
 * `@edt/shared`. The global filter renders it into the `ApiErrorBody` envelope.
 */
export class AppException extends HttpException {
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor(status: HttpStatus, code: ApiErrorCode, message: string, details?: unknown) {
    super({ statusCode: status, code, message, details }, status);
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown): AppException {
    return new AppException(HttpStatus.BAD_REQUEST, 'BAD_REQUEST', message, details);
  }

  static validation(message = 'Request validation failed', details?: unknown): AppException {
    return new AppException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_FAILED', message, details);
  }

  static unauthorised(message = 'Authentication required', details?: unknown): AppException {
    return new AppException(HttpStatus.UNAUTHORIZED, 'UNAUTHORISED', message, details);
  }

  static forbidden(message = 'You do not have access to this resource', details?: unknown): AppException {
    return new AppException(HttpStatus.FORBIDDEN, 'FORBIDDEN', message, details);
  }

  static notFound(message = 'Resource not found', details?: unknown): AppException {
    return new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', message, details);
  }

  static conflict(message: string, details?: unknown): AppException {
    return new AppException(HttpStatus.CONFLICT, 'CONFLICT', message, details);
  }

  static rateLimited(message = 'Too many requests', details?: unknown): AppException {
    return new AppException(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED', message, details);
  }

  static upstreamUnavailable(message = 'Upstream provider unavailable', details?: unknown): AppException {
    return new AppException(HttpStatus.SERVICE_UNAVAILABLE, 'UPSTREAM_UNAVAILABLE', message, details);
  }

  static internal(message = 'Unexpected server error', details?: unknown): AppException {
    return new AppException(HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR', message, details);
  }
}

const STATUS_TO_CODE: Record<number, ApiErrorCode> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORISED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_FAILED',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
  [HttpStatus.BAD_GATEWAY]: 'UPSTREAM_UNAVAILABLE',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'UPSTREAM_UNAVAILABLE',
  [HttpStatus.GATEWAY_TIMEOUT]: 'UPSTREAM_UNAVAILABLE',
};

export function errorCodeForStatus(status: number): ApiErrorCode {
  return STATUS_TO_CODE[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
}
