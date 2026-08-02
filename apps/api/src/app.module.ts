import { BullModule } from '@nestjs/bullmq';
import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Request } from 'express';

import { configuration, type AppConfig } from './config/configuration';
import { validateEnv } from './config/env.schema';

import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { HttpCacheInterceptor } from './common/interceptors/cache.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { MaintenanceGuard } from './common/guards/maintenance.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ThrottlerBehindProxyGuard } from './common/guards/throttler-behind-proxy.guard';

import { AuditModule } from './infra/audit/audit.module';
import { MailModule } from './infra/mail/mail.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RedisModule } from './infra/redis/redis.module';
import { UpstreamModule } from './infra/upstream/upstream.module';

import { AdminModule } from './modules/admin/admin.module';
import { AiModule } from './modules/ai/ai.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookmarksModule } from './modules/bookmarks/bookmarks.module';
import { CitiesModule } from './modules/cities/cities.module';
import { CountriesModule } from './modules/countries/countries.module';
import { EnvironmentModule } from './modules/environment/environment.module';
import { FlightsModule } from './modules/flights/flights.module';
import { HazardsModule } from './modules/hazards/hazards.module';
import { HealthModule } from './modules/health/health.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PreferencesModule } from './modules/preferences/preferences.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SearchModule } from './modules/search/search.module';
import { ShipsModule } from './modules/ships/ships.module';
import { ShipsRelayModule } from './modules/ships-relay/ships-relay.module';
import { SpaceModule } from './modules/space/space.module';
import { UsersModule } from './modules/users/users.module';
import { WeatherModule } from './modules/weather/weather.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';

/**
 * Composition root.
 *
 * Cross-cutting concerns are wired once here as global providers — validation,
 * error shape, response envelope, caching, auditing, authentication, RBAC, rate
 * limiting and maintenance mode — so individual controllers stay thin.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
      envFilePath: ['.env.local', '.env'],
    }),

    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const log = config.get('log', { infer: true });
        return {
          pinoHttp: {
            level: log.level,
            transport: log.pretty
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
            // pino-http hands these hooks the raw Node request/response, so they are
            // typed as such and narrowed to the Express shape where needed.
            genReqId: (request: IncomingMessage) => {
              const inbound = request.headers['x-request-id'];
              return typeof inbound === 'string' && inbound.length > 0 ? inbound : randomUUID();
            },
            customProps: (request: IncomingMessage) => ({
              requestId: (request as Request).requestId,
            }),
            // Never let credentials or tokens reach the log sink.
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.headers["x-api-key"]',
                'req.body.password',
                'req.body.currentPassword',
                'req.body.confirmPassword',
                'req.body.refreshToken',
                'req.body.token',
                'req.body.code',
                'res.headers["set-cookie"]',
              ],
              censor: '[redacted]',
            },
            autoLogging: {
              ignore: (request: IncomingMessage) =>
                (request.url ?? '').startsWith('/api/v1/health'),
            },
            customLogLevel: (
              _request: IncomingMessage,
              response: ServerResponse,
              error?: Error,
            ) => {
              if (error || response.statusCode >= 500) return 'error';
              if (response.statusCode >= 400) return 'warn';
              return 'info';
            },
          },
        };
      },
    }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const throttle = config.get('throttle', { infer: true });
        return {
          throttlers: [{ name: 'default', ttl: throttle.ttl * 1000, limit: throttle.limit }],
        };
      },
    }),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const redis = config.get('redis', { infer: true });
        const queue = config.get('queue', { infer: true });
        const url = new URL(redis.url);
        return {
          prefix: queue.prefix,
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            username: url.username || undefined,
            password: url.password || undefined,
            db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
            maxRetriesPerRequest: null,
          },
        };
      },
    }),

    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot({ wildcard: true, maxListeners: 20 }),

    // Infrastructure (global providers)
    PrismaModule,
    RedisModule,
    UpstreamModule,
    AuditModule,
    MailModule,

    // Feature modules
    AuthModule,
    UsersModule,
    PreferencesModule,
    SearchModule,
    CountriesModule,
    CitiesModule,
    WeatherModule,
    EnvironmentModule,
    HazardsModule,
    FlightsModule,
    ShipsModule,
    ShipsRelayModule,
    SpaceModule,
    AnalyticsModule,
    BookmarksModule,
    WorkspacesModule,
    ReportsModule,
    NotificationsModule,
    AiModule,
    AdminModule,
    HealthModule,
    JobsModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    // Interceptor order matters: cache short-circuits before the envelope is
    // applied, and auditing wraps the outcome of the handler.
    { provide: APP_INTERCEPTOR, useClass: HttpCacheInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: MaintenanceGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
