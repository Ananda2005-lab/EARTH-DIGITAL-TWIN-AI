import { Injectable, type ArgumentMetadata, type PipeTransform } from '@nestjs/common';
import { ZodError, type ZodTypeAny } from 'zod';
import { AppException } from '../errors/app-exception';
import { isZodDto } from '../zod/zod-dto';

export interface ZodIssueDetail {
  path: string;
  message: string;
  code: string;
}

/**
 * Validates and coerces the incoming payload with a Zod schema.
 *
 * Registered globally: when a handler parameter is typed with a `zodDto()` class
 * the schema is discovered automatically. It can also be used explicitly for a
 * single parameter: `@Query(new ZodValidationPipe(hazardQuerySchema))`.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: ZodTypeAny) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const schema = this.schema ?? this.resolveSchema(metadata);
    if (!schema) return value;

    const result = schema.safeParse(value);
    if (result.success) return result.data;

    throw AppException.validation('Request validation failed', {
      source: metadata.type,
      issues: flattenZodError(result.error),
    });
  }

  private resolveSchema(metadata: ArgumentMetadata): ZodTypeAny | undefined {
    const metatype = metadata.metatype;
    if (!isZodDto(metatype)) return undefined;
    return metatype.zodSchema;
  }
}

export function flattenZodError(error: ZodError): ZodIssueDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
    code: issue.code,
  }));
}
