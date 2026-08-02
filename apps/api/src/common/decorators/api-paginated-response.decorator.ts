import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

const PAGINATION_META: Record<string, SchemaObject> = {
  page: { type: 'integer', example: 1 },
  pageSize: { type: 'integer', example: 24 },
  total: { type: 'integer', example: 137 },
  totalPages: { type: 'integer', example: 6 },
  hasNext: { type: 'boolean' },
  hasPrevious: { type: 'boolean' },
};

const RESPONSE_META: SchemaObject = {
  type: 'object',
  properties: {
    requestId: { type: 'string', format: 'uuid' },
    tookMs: { type: 'integer' },
    cached: { type: 'boolean' },
    cacheAge: { type: 'integer' },
    attribution: { type: 'string' },
  },
};

/**
 * Documents the `ApiResponse<PaginatedResult<T>>` envelope for list endpoints.
 * Accepts either a model class or a raw OpenAPI schema for items.
 */
export function ApiPaginatedResponse(
  model: Type<unknown> | SchemaObject,
  description = 'Paginated result',
): MethodDecorator & ClassDecorator {
  const isModel = typeof model === 'function';
  const itemSchema: SchemaObject = isModel
    ? ({ $ref: getSchemaPath(model) } as unknown as SchemaObject)
    : model;

  const decorators: (MethodDecorator & ClassDecorator)[] = [];
  if (isModel) decorators.push(ApiExtraModels(model));

  decorators.push(
    ApiOkResponse({
      description,
      schema: {
        type: 'object',
        required: ['data'],
        properties: {
          data: {
            type: 'object',
            required: [
              'items',
              'page',
              'pageSize',
              'total',
              'totalPages',
              'hasNext',
              'hasPrevious',
            ],
            properties: {
              items: { type: 'array', items: itemSchema },
              ...PAGINATION_META,
            },
          },
          meta: RESPONSE_META,
        },
      },
    }),
  );

  return applyDecorators(...decorators);
}

/** Documents the plain `ApiResponse<T>` envelope around an arbitrary schema. */
export function ApiEnvelopeResponse(
  schema: SchemaObject,
  description = 'Successful response',
): MethodDecorator & ClassDecorator {
  return ApiOkResponse({
    description,
    schema: {
      type: 'object',
      required: ['data'],
      properties: { data: schema, meta: RESPONSE_META },
    },
  });
}
