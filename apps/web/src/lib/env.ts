import { z } from 'zod';

/**
 * Server-side environment. Validated lazily so that a missing optional provider
 * key degrades a single feature instead of crashing the whole app at boot.
 */
<<<<<<< HEAD
const optionalCredential = (minimumLength: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().min(minimumLength).optional(),
  );
=======
const optionalString = (min: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === '' ? undefined : value))
    .pipe(z.string().min(min).optional());
>>>>>>> 005c357b565eaf6ff99b0cc04ff8ed07cf1d64a0

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_BASE_URL: z.string().url().default('http://localhost:4000/api/v1'),
  AI_BASE_URL: z.string().url().default('http://localhost:8000'),
  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(12_000),

<<<<<<< HEAD
  // Empty values from `.env.local` mean "not configured", just like an absent
  // variable. Non-empty credentials still retain their minimum-length checks.
  NASA_FIRMS_API_KEY: optionalCredential(8),
  OPENSKY_CLIENT_ID: optionalCredential(3),
  OPENSKY_CLIENT_SECRET: optionalCredential(3),
  AISSTREAM_API_KEY: optionalCredential(8),
  TOMTOM_API_KEY: optionalCredential(8),
  MAPTILER_API_KEY: optionalCredential(8),
  CESIUM_ION_TOKEN: optionalCredential(8),
=======
  // Optional provider credentials — features self-disable when absent.
  NASA_FIRMS_API_KEY: optionalString(8),
  OPENSKY_CLIENT_ID: optionalString(3),
  OPENSKY_CLIENT_SECRET: optionalString(3),
  AISSTREAM_API_KEY: optionalString(8),
  TOMTOM_API_KEY: optionalString(8),
  MAPTILER_API_KEY: optionalString(8),
  CESIUM_ION_TOKEN: optionalString(8),
>>>>>>> 005c357b565eaf6ff99b0cc04ff8ed07cf1d64a0
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_API_URL: z.string().default('/api'),
  NEXT_PUBLIC_ENABLE_ANALYTICS: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

let cachedServerEnv: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid server environment: ${issues}`);
  }
  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

export const clientEnv: ClientEnv = clientSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_ENABLE_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS,
});

/** Which optional integrations are configured, exposed to the UI as capability hints. */
export function providerCapabilities() {
  const env = process.env;
  return {
    firms: Boolean(env.NASA_FIRMS_API_KEY),
    opensky: Boolean(env.OPENSKY_CLIENT_ID && env.OPENSKY_CLIENT_SECRET),
    ais: Boolean(env.AISSTREAM_API_KEY),
    traffic: Boolean(env.TOMTOM_API_KEY),
    maptiler: Boolean(env.MAPTILER_API_KEY),
    cesium: Boolean(env.CESIUM_ION_TOKEN),
  };
}
