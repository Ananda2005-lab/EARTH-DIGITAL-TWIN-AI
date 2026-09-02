import { z } from 'zod';

const bool = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined || value.trim() === '') return fallback;
      return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
    });

const int = (fallback: number, min?: number, max?: number) => {
  let schema = z.coerce.number().int();
  if (min !== undefined) schema = schema.min(min);
  if (max !== undefined) schema = schema.max(max);
  return z
    .string()
    .optional()
    .transform((value) => (value === undefined || value.trim() === '' ? String(fallback) : value))
    .pipe(schema);
};

<<<<<<< HEAD
const optionalString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);
=======
const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === '' ? undefined : value))
  .pipe(z.string().min(1).optional());
>>>>>>> 005c357b565eaf6ff99b0cc04ff8ed07cf1d64a0

/**
 * Authoritative description of every environment variable the API reads.
 * Validation runs once at boot; a malformed environment fails fast instead of
 * surfacing as a confusing runtime error hours later.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_NAME: z.string().default('Earth Digital Twin AI API'),
  PORT: int(4000, 1, 65_535),
  HOST: z.string().default('0.0.0.0'),
  WEB_APP_URL: z.string().url().default('http://localhost:3000'),
  PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  TRUST_PROXY: bool(true),
  SWAGGER_ENABLED: bool(true),
  MAINTENANCE_MODE: bool(false),
  SHUTDOWN_TIMEOUT_MS: int(10_000, 0, 120_000),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  LOG_PRETTY: bool(false),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_LOG_QUERIES: bool(false),

  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_KEY_PREFIX: z.string().default('edt:'),
  CACHE_TTL_DEFAULT: int(60, 1, 86_400),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: int(30, 1, 365),
  JWT_ISSUER: z.string().default('earth-digital-twin'),
  JWT_AUDIENCE: z.string().default('earth-digital-twin-web'),
  BCRYPT_COST: int(12, 10, 15),
  MFA_ENCRYPTION_KEY: z.string().min(32, 'MFA_ENCRYPTION_KEY must be at least 32 characters'),
  MFA_ISSUER: z.string().default('Earth Digital Twin'),
  PASSWORD_RESET_TTL_MINUTES: int(30, 5, 1440),
  EMAIL_VERIFY_TTL_HOURS: int(48, 1, 720),
  MAX_FAILED_LOGINS: int(8, 3, 50),
  LOGIN_LOCK_MINUTES: int(15, 1, 1440),

  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GOOGLE_CALLBACK_URL: optionalString,
  GITHUB_CLIENT_ID: optionalString,
  GITHUB_CLIENT_SECRET: optionalString,
  GITHUB_CALLBACK_URL: optionalString,
  OAUTH_SUCCESS_REDIRECT: z.string().default('http://localhost:3000/auth/callback'),
  OAUTH_FAILURE_REDIRECT: z.string().default('http://localhost:3000/login?error=oauth'),

  MAIL_ENABLED: bool(false),
  MAIL_FROM: z.string().default('Earth Digital Twin <no-reply@earthdigitaltwin.ai>'),
  SMTP_HOST: optionalString,
  SMTP_PORT: int(587, 1, 65_535),
  SMTP_SECURE: bool(false),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,

  THROTTLE_TTL_SECONDS: int(60, 1, 3600),
  THROTTLE_LIMIT: int(240, 1, 100_000),
  AUTH_THROTTLE_TTL_SECONDS: int(300, 1, 3600),
  AUTH_THROTTLE_LIMIT: int(10, 1, 1000),

  UPSTREAM_TIMEOUT_MS: int(8000, 500, 60_000),
  UPSTREAM_RETRIES: int(2, 0, 6),
  UPSTREAM_BACKOFF_MS: int(250, 10, 10_000),
  CIRCUIT_FAILURE_THRESHOLD: int(5, 1, 100),
  CIRCUIT_RESET_MS: int(30_000, 1000, 600_000),

  AI_SERVICE_URL: z.string().default('http://localhost:8000'),
  AI_SERVICE_TOKEN: optionalString,
  AI_MODEL: z.string().default('edt-analyst-1'),
  AI_TIMEOUT_MS: int(60_000, 1000, 300_000),
  AI_DAILY_TOKEN_BUDGET: int(2_000_000, 0, 1_000_000_000),

  NASA_FIRMS_API_KEY: optionalString,
  OPENSKY_CLIENT_ID: optionalString,
  OPENSKY_CLIENT_SECRET: optionalString,
  AISSTREAM_API_KEY: optionalString,
  AISSTREAM_BBOX: z.string().default('-180,-90,180,90'),
  AISSTREAM_SNAPSHOT_TTL: int(120, 10, 3600),

  QUEUE_PREFIX: z.string().default('edt-jobs'),
  QUEUE_CONCURRENCY: int(4, 1, 64),
  JOBS_ENABLED: bool(true),
  CACHE_WARM_CRON_ENABLED: bool(true),

  SEED_OWNER_EMAIL: z.string().email().default('owner@earthdigitaltwin.ai'),
  SEED_OWNER_PASSWORD: optionalString,
  SEED_ADMIN_EMAIL: z.string().email().default('admin@earthdigitaltwin.ai'),
  SEED_ADMIN_PASSWORD: optionalString,
  SEED_ANALYST_EMAIL: z.string().email().default('analyst@earthdigitaltwin.ai'),
  SEED_ANALYST_PASSWORD: optionalString,
  SEED_DEMO_EMAIL: z.string().email().default('demo@earthdigitaltwin.ai'),
  SEED_DEMO_PASSWORD: optionalString,
  SEED_CITY_LIMIT: int(2000, 1, 200_000),
});

export type Env = z.infer<typeof envSchema>;

/** `ConfigModule` validation hook. Throws with every problem listed at once. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return result.data;
}
