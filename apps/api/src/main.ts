import 'reflect-metadata';
import { VersioningType, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { PLATFORM } from '@edt/shared';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';

const GLOBAL_PREFIX = 'api/v1';

/** Swagger is mounted before the prefix so the URL stays `/api/docs`. */
function configureSwagger(app: INestApplication, config: ConfigService<AppConfig, true>): void {
  if (!config.get('swaggerEnabled', { infer: true })) return;

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle(`${PLATFORM.name} API`)
      .setDescription(
        [
          PLATFORM.tagline,
          '',
          'Every response is wrapped in `{ data, meta }`; failures use the shared `ApiErrorBody` shape',
          '(`statusCode`, `code`, `message`, `details`, `path`, `requestId`, `timestamp`).',
          '',
          'Authenticate with `Authorization: Bearer <accessToken>` (15 minute lifetime, rotate via',
          '`POST /auth/refresh`) or with `x-api-key` for machine access.',
        ].join('\n'),
      )
      .setVersion(PLATFORM.version)
      .setContact('Earth Digital Twin AI', config.get('webAppUrl', { infer: true }), PLATFORM.supportEmail)
      .addServer(`${config.get('publicApiUrl', { infer: true })}/${GLOBAL_PREFIX}`, 'Current environment')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Access token from /auth/login' },
        'bearer',
      )
      .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header', description: 'Machine credential' }, 'apiKey')
      .addTag('auth', 'Registration, sessions, MFA and OAuth')
      .addTag('users', 'Profile and activity history')
      .addTag('preferences', 'Appearance, units and layer defaults')
      .addTag('search', 'Gazetteer and geocoding')
      .addTag('countries', 'Country reference data')
      .addTag('cities', 'Urban gazetteer')
      .addTag('weather', 'Forecast, marine and grid sampling')
      .addTag('environment', 'Air quality and climate')
      .addTag('hazards', 'Fused multi-provider hazard feed')
      .addTag('flights', 'Live ADS-B traffic')
      .addTag('ships', 'Live AIS traffic')
      .addTag('space', 'Space weather and orbital objects')
      .addTag('analytics', 'Indicators, rankings and correlations')
      .addTag('bookmarks', 'Saved places and collections')
      .addTag('workspaces', 'Collaborative scenes')
      .addTag('reports', 'AI-generated intelligence briefs')
      .addTag('notifications', 'Inbox and delivery preferences')
      .addTag('ai', 'Planetary analyst')
      .addTag('admin', 'Administration')
      .addTag('admin-system', 'Owner-only operations')
      .addTag('health', 'Probes')
      .build(),
    { operationIdFactory: (controllerKey, methodKey) => `${controllerKey.replace('Controller', '')}_${methodKey}` },
  );

  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: `${PLATFORM.name} API reference`,
    jsonDocumentUrl: 'api/docs/json',
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true, tagsSorter: 'alpha' },
  });
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    // Raw body is not needed anywhere, so keep the JSON limit tight.
    bodyParser: true,
  });

  const config = app.get<ConfigService<AppConfig, true>>(ConfigService);
  app.useLogger(app.get(PinoLogger));

  if (config.get('trustProxy', { infer: true })) {
    app.set('trust proxy', 1);
  }

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // Swagger UI ships inline styles/scripts; the API serves no other HTML.
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'no-referrer' },
      hsts: config.get('isProduction', { infer: true })
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
    }),
  );
  app.use(compression());
  app.use(cookieParser());

  app.enableCors({
    origin: config.get('corsOrigins', { infer: true }),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization', 'x-api-key', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
    maxAge: 86_400,
  });

  app.setGlobalPrefix(GLOBAL_PREFIX, { exclude: ['api/docs', 'api/docs/json'] });
  // The major version lives in the path prefix (`/api/v1`). Header versioning is
  // enabled on top of it so a future minor revision of a single endpoint can be
  // introduced with `x-api-version` without moving every other route.
  app.enableVersioning({ type: VersioningType.HEADER, header: 'x-api-version', defaultVersion: '1' });

  configureSwagger(app, config);

  // Drain in-flight requests and close Prisma/Redis/BullMQ cleanly.
  app.enableShutdownHooks();

  const port = config.get('port', { infer: true });
  const host = config.get('host', { infer: true });
  await app.listen(port, host);

  const logger = app.get(PinoLogger);
  logger.log(
    `${PLATFORM.name} API listening on http://${host}:${port}/${GLOBAL_PREFIX} (docs: /api/docs, env: ${config.get('env', { infer: true })})`,
  );
}

void bootstrap();
