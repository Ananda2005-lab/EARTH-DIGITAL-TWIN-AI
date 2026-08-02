import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { z } from 'zod';

/**
 * Compact Zod → OpenAPI 3 translator.
 *
 * The platform's single source of truth for request shapes is `@edt/shared`'s Zod
 * schemas, so Swagger has to be derived from them rather than duplicated in
 * decorators. Only the constructs the shared schemas actually use are handled;
 * anything exotic degrades to an untyped object rather than throwing.
 */
export function zodToOpenApi(schema: z.ZodTypeAny, depth = 0): SchemaObject {
  if (depth > 12) return {};

  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    const inner = zodToOpenApi(schema.unwrap() as z.ZodTypeAny, depth + 1);
    return schema instanceof z.ZodNullable ? { ...inner, nullable: true } : inner;
  }

  if (schema instanceof z.ZodDefault) {
    const inner = zodToOpenApi(schema._def.innerType as z.ZodTypeAny, depth + 1);
    return { ...inner, default: schema._def.defaultValue() as unknown };
  }

  if (schema instanceof z.ZodEffects) {
    return zodToOpenApi(schema.innerType() as z.ZodTypeAny, depth + 1);
  }

  if (schema instanceof z.ZodPipeline) {
    return zodToOpenApi(schema._def.out as z.ZodTypeAny, depth + 1);
  }

  if (schema instanceof z.ZodLazy) {
    return zodToOpenApi(schema._def.getter() as z.ZodTypeAny, depth + 1);
  }

  if (schema instanceof z.ZodBranded) {
    return zodToOpenApi(schema.unwrap() as z.ZodTypeAny, depth + 1);
  }

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    const properties: Record<string, SchemaObject> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToOpenApi(value, depth + 1);
      if (!value.isOptional()) required.push(key);
    }
    const result: SchemaObject = { type: 'object', properties };
    if (required.length > 0) result.required = required;
    return result;
  }

  if (schema instanceof z.ZodArray) {
    const result: SchemaObject = {
      type: 'array',
      items: zodToOpenApi(schema.element as z.ZodTypeAny, depth + 1),
    };
    if (schema._def.minLength) result.minItems = schema._def.minLength.value;
    if (schema._def.maxLength) result.maxItems = schema._def.maxLength.value;
    return result;
  }

  if (schema instanceof z.ZodTuple) {
    const items = (schema._def.items as z.ZodTypeAny[]).map((item) => zodToOpenApi(item, depth + 1));
    return {
      type: 'array',
      items: items[0] ?? {},
      minItems: items.length,
      maxItems: items.length,
    };
  }

  if (schema instanceof z.ZodString) {
    const result: SchemaObject = { type: 'string' };
    for (const check of schema._def.checks) {
      if (check.kind === 'min') result.minLength = check.value;
      if (check.kind === 'max') result.maxLength = check.value;
      if (check.kind === 'email') result.format = 'email';
      if (check.kind === 'url') result.format = 'uri';
      if (check.kind === 'uuid') result.format = 'uuid';
      if (check.kind === 'datetime') result.format = 'date-time';
      if (check.kind === 'regex') result.pattern = check.regex.source;
    }
    return result;
  }

  if (schema instanceof z.ZodNumber) {
    const result: SchemaObject = { type: schema.isInt ? 'integer' : 'number' };
    for (const check of schema._def.checks) {
      if (check.kind === 'min') result.minimum = check.value;
      if (check.kind === 'max') result.maximum = check.value;
    }
    return result;
  }

  if (schema instanceof z.ZodBoolean) return { type: 'boolean' };
  if (schema instanceof z.ZodDate) return { type: 'string', format: 'date-time' };
  if (schema instanceof z.ZodEnum) return { type: 'string', enum: [...(schema.options as string[])] };
  if (schema instanceof z.ZodNativeEnum) {
    return { type: 'string', enum: Object.values(schema.enum as Record<string, string>) };
  }
  if (schema instanceof z.ZodLiteral) {
    const value = schema.value as unknown;
    const type = typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string';
    return { type, enum: [value] };
  }
  if (schema instanceof z.ZodUnion) {
    return { oneOf: (schema.options as z.ZodTypeAny[]).map((option) => zodToOpenApi(option, depth + 1)) };
  }
  if (schema instanceof z.ZodDiscriminatedUnion) {
    const options = [...(schema.options as z.ZodTypeAny[])];
    return { oneOf: options.map((option) => zodToOpenApi(option, depth + 1)) };
  }
  if (schema instanceof z.ZodIntersection) {
    return {
      allOf: [
        zodToOpenApi(schema._def.left as z.ZodTypeAny, depth + 1),
        zodToOpenApi(schema._def.right as z.ZodTypeAny, depth + 1),
      ],
    };
  }
  if (schema instanceof z.ZodRecord) {
    return {
      type: 'object',
      additionalProperties: zodToOpenApi(schema._def.valueType as z.ZodTypeAny, depth + 1),
    };
  }
  if (schema instanceof z.ZodNull) return { type: 'string', nullable: true };

  return {};
}

/** Flatten an object schema into OpenAPI query parameter definitions. */
export function zodToQueryParameters(
  schema: z.ZodTypeAny,
): { name: string; required: boolean; schema: SchemaObject; description?: string }[] {
  const converted = zodToOpenApi(schema);
  if (converted.type !== 'object' || !converted.properties) return [];
  const required = new Set(converted.required ?? []);
  return Object.entries(converted.properties).map(([name, property]) => ({
    name,
    required: required.has(name),
    schema: property as SchemaObject,
    description: (property as SchemaObject).description,
  }));
}
