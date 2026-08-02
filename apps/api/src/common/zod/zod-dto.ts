import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import type { z } from 'zod';
import { zodToOpenApi } from './zod-to-openapi';

export const ZOD_SCHEMA_KEY = 'edt:zod-schema';

export interface ZodDtoClass<TOutput, TInput = TOutput> {
  new (): TOutput;
  /** The schema the global pipe validates against. */
  readonly zodSchema: z.ZodType<TOutput, z.ZodTypeDef, TInput>;
  /** Lazily built OpenAPI schema so Swagger documents the real contract. */
  readonly openApiSchema: SchemaObject;
  parse(input: unknown): TOutput;
}

/**
 * Turn a Zod schema from `@edt/shared` into a Nest DTO class.
 *
 * Controllers keep the ergonomic `@Body() dto: CreateBookmarkDto` signature, the
 * global `ZodValidationPipe` finds the schema through the class, and Swagger gets
 * an accurate body/query schema — all from one definition.
 */
export function zodDto<TOutput, TDef extends z.ZodTypeDef, TInput>(
  schema: z.ZodType<TOutput, TDef, TInput>,
): ZodDtoClass<TOutput, TInput> {
  let cachedOpenApi: SchemaObject | undefined;

  class GeneratedZodDto {
    static readonly zodSchema = schema;

    static get openApiSchema(): SchemaObject {
      cachedOpenApi ??= zodToOpenApi(schema);
      return cachedOpenApi;
    }

    static parse(input: unknown): TOutput {
      return schema.parse(input);
    }
  }

  return GeneratedZodDto as unknown as ZodDtoClass<TOutput, TInput>;
}

interface MaybeZodDto {
  zodSchema?: unknown;
}

/** Type guard used by the pipe to decide whether a metatype carries a schema. */
export function isZodDto(metatype: unknown): metatype is ZodDtoClass<unknown> {
  if (typeof metatype !== 'function') return false;
  const candidate = metatype as MaybeZodDto;
  return typeof candidate.zodSchema === 'object' && candidate.zodSchema !== null;
}

/** OpenAPI schema for a generated DTO, for use in `@ApiBody({ schema })`. */
export function dtoSchema(dto: ZodDtoClass<unknown, unknown>): SchemaObject {
  return dto.openApiSchema;
}
