import { envSchema, type Env } from './env.schema';

export interface AppConfig {
  env: Env['NODE_ENV'];
  isProduction: boolean;
  appName: string;
  port: number;
  host: string;
  webAppUrl: string;
  publicApiUrl: string;
  corsOrigins: string[];
  trustProxy: boolean;
  swaggerEnabled: boolean;
  maintenanceMode: boolean;
  shutdownTimeoutMs: number;
  log: { level: Env['LOG_LEVEL']; pretty: boolean };
  database: { url: string; logQueries: boolean };
  redis: { url: string; keyPrefix: string; defaultTtl: number };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtlDays: number;
    issuer: string;
    audience: string;
  };
  security: {
    bcryptCost: number;
    mfaEncryptionKey: string;
    mfaIssuer: string;
    passwordResetTtlMinutes: number;
    emailVerifyTtlHours: number;
    maxFailedLogins: number;
    loginLockMinutes: number;
  };
  oauth: {
    google: { clientId?: string; clientSecret?: string; callbackUrl?: string; enabled: boolean };
    github: { clientId?: string; clientSecret?: string; callbackUrl?: string; enabled: boolean };
    successRedirect: string;
    failureRedirect: string;
  };
  mail: {
    enabled: boolean;
    from: string;
    host?: string;
    port: number;
    secure: boolean;
    user?: string;
    password?: string;
  };
  throttle: { ttl: number; limit: number; authTtl: number; authLimit: number };
  upstream: {
    timeoutMs: number;
    retries: number;
    backoffMs: number;
    circuitFailureThreshold: number;
    circuitResetMs: number;
    keys: {
      nasaFirms?: string;
      openSkyClientId?: string;
      openSkyClientSecret?: string;
      aisStream?: string;
    };
  };
  ai: {
    serviceUrl: string;
    token?: string;
    model: string;
    timeoutMs: number;
    dailyTokenBudget: number;
  };
  ships: { aisStreamKey?: string; bbox: [number, number, number, number]; snapshotTtl: number };
  queue: { prefix: string; concurrency: number; enabled: boolean; cacheWarmEnabled: boolean };
}

function parseBbox(raw: string): [number, number, number, number] {
  const parts = raw.split(',').map((value) => Number.parseFloat(value.trim()));
  const [west, south, east, north] = parts;
  if (
    parts.length !== 4 ||
    west === undefined ||
    south === undefined ||
    east === undefined ||
    north === undefined ||
    !Number.isFinite(west) ||
    !Number.isFinite(south) ||
    !Number.isFinite(east) ||
    !Number.isFinite(north)
  ) {
    return [-180, -90, 180, 90];
  }
  return [west, south, east, north];
}

/**
 * Namespaced, fully typed configuration derived from the validated environment.
 * Consumers inject `ConfigService<AppConfig, true>` and read a namespace, so no
 * string typo can silently produce `undefined`.
 */
export function configuration(): AppConfig {
  const env = envSchema.parse(process.env);

  return {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    appName: env.APP_NAME,
    port: env.PORT,
    host: env.HOST,
    webAppUrl: env.WEB_APP_URL,
    publicApiUrl: env.PUBLIC_API_URL,
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    trustProxy: env.TRUST_PROXY,
    swaggerEnabled: env.SWAGGER_ENABLED,
    maintenanceMode: env.MAINTENANCE_MODE,
    shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS,
    log: { level: env.LOG_LEVEL, pretty: env.LOG_PRETTY },
    database: { url: env.DATABASE_URL, logQueries: env.DATABASE_LOG_QUERIES },
    redis: {
      url: env.REDIS_URL,
      keyPrefix: env.REDIS_KEY_PREFIX,
      defaultTtl: env.CACHE_TTL_DEFAULT,
    },
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessTtl: env.JWT_ACCESS_TTL,
      refreshTtlDays: env.JWT_REFRESH_TTL_DAYS,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    },
    security: {
      bcryptCost: env.BCRYPT_COST,
      mfaEncryptionKey: env.MFA_ENCRYPTION_KEY,
      mfaIssuer: env.MFA_ISSUER,
      passwordResetTtlMinutes: env.PASSWORD_RESET_TTL_MINUTES,
      emailVerifyTtlHours: env.EMAIL_VERIFY_TTL_HOURS,
      maxFailedLogins: env.MAX_FAILED_LOGINS,
      loginLockMinutes: env.LOGIN_LOCK_MINUTES,
    },
    oauth: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackUrl: env.GOOGLE_CALLBACK_URL,
        enabled: Boolean(
          env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL,
        ),
      },
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        callbackUrl: env.GITHUB_CALLBACK_URL,
        enabled: Boolean(
          env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.GITHUB_CALLBACK_URL,
        ),
      },
      successRedirect: env.OAUTH_SUCCESS_REDIRECT,
      failureRedirect: env.OAUTH_FAILURE_REDIRECT,
    },
    mail: {
      enabled: env.MAIL_ENABLED,
      from: env.MAIL_FROM,
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER,
      password: env.SMTP_PASSWORD,
    },
    throttle: {
      ttl: env.THROTTLE_TTL_SECONDS,
      limit: env.THROTTLE_LIMIT,
      authTtl: env.AUTH_THROTTLE_TTL_SECONDS,
      authLimit: env.AUTH_THROTTLE_LIMIT,
    },
    upstream: {
      timeoutMs: env.UPSTREAM_TIMEOUT_MS,
      retries: env.UPSTREAM_RETRIES,
      backoffMs: env.UPSTREAM_BACKOFF_MS,
      circuitFailureThreshold: env.CIRCUIT_FAILURE_THRESHOLD,
      circuitResetMs: env.CIRCUIT_RESET_MS,
      keys: {
        nasaFirms: env.NASA_FIRMS_API_KEY,
        openSkyClientId: env.OPENSKY_CLIENT_ID,
        openSkyClientSecret: env.OPENSKY_CLIENT_SECRET,
        aisStream: env.AISSTREAM_API_KEY,
      },
    },
    ai: {
      serviceUrl: env.AI_SERVICE_URL,
      token: env.AI_SERVICE_TOKEN,
      model: env.AI_MODEL,
      timeoutMs: env.AI_TIMEOUT_MS,
      dailyTokenBudget: env.AI_DAILY_TOKEN_BUDGET,
    },
    ships: {
      aisStreamKey: env.AISSTREAM_API_KEY,
      bbox: parseBbox(env.AISSTREAM_BBOX),
      snapshotTtl: env.AISSTREAM_SNAPSHOT_TTL,
    },
    queue: {
      prefix: env.QUEUE_PREFIX,
      concurrency: env.QUEUE_CONCURRENCY,
      enabled: env.JOBS_ENABLED,
      cacheWarmEnabled: env.CACHE_WARM_CRON_ENABLED,
    },
  };
}

export type TypedConfig = AppConfig;
