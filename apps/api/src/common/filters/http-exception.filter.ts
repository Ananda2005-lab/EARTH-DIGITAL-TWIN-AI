import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import type { ApiErrorBody, ApiErrorCode } from '@edt/shared';
import { ZodError } from 'zod';
import { AppException, errorCodeForStatus } from '../errors/app-exception';
import { flattenZodError } from '../pipes/zod-validation.pipe';

interface NestErrorPayload {
  message?: unknown;
  code?: unknown;
  details?: unknown;
  error?: unknown;
}

/** Plain number so the comparison below is numeric rather than enum-to-number. */
const SERVER_ERROR_THRESHOLD: number = HttpStatus.INTERNAL_SERVER_ERROR;

/**
 * Single exit point for every failure. Produces the `ApiErrorBody` contract from
 * `@edt/shared` so the web tier can branch on `code` instead of parsing prose,
 * and guarantees stack traces / secrets never reach the client.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const resolved = this.resolve(exception);
    const body: ApiErrorBody = {
      statusCode: resolved.status,
      code: resolved.code,
      message: resolved.message,
      details: resolved.details,
      path: request.originalUrl ?? request.url,
      requestId: request.requestId ?? 'unknown',
      timestamp: new Date().toISOString(),
    };

    if (resolved.status >= SERVER_ERROR_THRESHOLD) {
      this.logger.error(
        { requestId: body.requestId, path: body.path, code: body.code },
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn({
        requestId: body.requestId,
        path: body.path,
        code: body.code,
        status: body.statusCode,
      });
    }

    if (response.headersSent) return;
    response.status(resolved.status).json(body);
  }

  private resolve(exception: unknown): {
    status: number;
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  } {
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof ZodError) {
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: { issues: flattenZodError(exception) },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        return { status, code: errorCodeForStatus(status), message: payload };
      }
      const record = payload as NestErrorPayload;
      const message = Array.isArray(record.message)
        ? record.message.map((entry) => String(entry)).join(', ')
        : typeof record.message === 'string'
          ? record.message
          : exception.message;
      return {
        status,
        code:
          typeof record.code === 'string'
            ? (record.code as ApiErrorCode)
            : errorCodeForStatus(status),
        message,
        details: record.details,
      };
    }

    const prismaMapped = this.mapPrisma(exception);
    if (prismaMapped) return prismaMapped;

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Unexpected server error',
    };
  }

  private mapPrisma(
    exception: unknown,
  ): { status: number; code: ApiErrorCode; message: string; details?: unknown } | undefined {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          return {
            status: HttpStatus.CONFLICT,
            code: 'CONFLICT',
            message: 'A record with these unique values already exists',
            details: { target: exception.meta?.target },
          };
        case 'P2003':
        case 'P2014':
          return {
            status: HttpStatus.CONFLICT,
            code: 'CONFLICT',
            message: 'The change violates a relation constraint',
          };
        case 'P2025':
          return { status: HttpStatus.NOT_FOUND, code: 'NOT_FOUND', message: 'Resource not found' };
        default:
          return {
            status: HttpStatus.BAD_REQUEST,
            code: 'BAD_REQUEST',
            message: 'The database rejected the request',
            details: { prismaCode: exception.code },
          };
      }
    }
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        code: 'BAD_REQUEST',
        message: 'The database rejected the request shape',
      };
    }
    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'UPSTREAM_UNAVAILABLE',
        message: 'Database is unavailable',
      };
    }
    return undefined;
  }
}
