import { type INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { ZodValidationPipe } from '../src/common/pipes/zod-validation.pipe';
import { AiController } from '../src/modules/ai/ai.controller';
import { AiService } from '../src/modules/ai/ai.service';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { MfaService } from '../src/modules/auth/mfa.service';
import { HealthController } from '../src/modules/health/health.controller';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { RedisService } from '../src/infra/redis/redis.service';
import { UpstreamService } from '../src/infra/upstream/upstream.service';

const user = { id: 'user-1', email: 'user@example.com', role: 'user', plan: 'free', sessionId: 'session-1' };
const session = {
  user,
  tokens: { accessToken: 'access', refreshToken: 'refresh-token-value-12345', expiresIn: 900, tokenType: 'Bearer' },
};

describe('API HTTP behavior (e2e)', () => {
  let app: INestApplication;
  const auth = {
    register: jest.fn(), login: jest.fn(), refresh: jest.fn(), logout: jest.fn(),
    resendVerification: jest.fn(), forgotPassword: jest.fn(), verifyEmail: jest.fn(),
  };
  const ai = { chat: jest.fn(), compare: jest.fn(), usage: jest.fn(), listConversations: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController, AuthController, AiController],
      providers: [
        Reflector,
        { provide: AuthService, useValue: auth },
        { provide: MfaService, useValue: {} },
        { provide: AiService, useValue: ai },
        { provide: PrismaService, useValue: { ping: jest.fn().mockResolvedValue(5) } },
        { provide: RedisService, useValue: { ping: jest.fn().mockResolvedValue(3) } },
        { provide: UpstreamService, useValue: { circuitSnapshots: jest.fn().mockReturnValue([]) } },
        { provide: ConfigService, useValue: { get: jest.fn((key: string) => {
          if (key === 'jwt') return { refreshTtlDays: 30 };
          if (key === 'isProduction') return false;
          return { successRedirect: 'http://web/success', failureRedirect: 'http://web/failure' };
        }) } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use((req: { requestId?: string; startedAt?: number; user?: typeof user }, _res: unknown, next: () => void) => {
      req.requestId = 'e2e-request';
      req.startedAt = Date.now();
      req.user = user;
      next();
    });
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor(moduleRef.get(Reflector)));
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    auth.login.mockResolvedValue(session);
    auth.register.mockResolvedValue(session);
    ai.chat.mockResolvedValue({ conversationId: 'conversation-1', message: { content: 'Hello' } });
  });

  afterAll(async () => app.close());

  it('serves liveness through the real health controller and response transform', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(response.body.data).toMatchObject({ status: 'ok', version: '1.0.0' });
    expect(response.body.meta).toMatchObject({ requestId: 'e2e-request', cached: false });
  });

  it('validates registration bodies before invoking the auth service', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'short', name: 'A', acceptTerms: false })
      .expect(422);

    expect(response.body).toMatchObject({
      statusCode: 422, code: 'VALIDATION_FAILED', path: '/api/v1/auth/register', requestId: 'e2e-request',
    });
    expect(response.body.details.issues.length).toBeGreaterThan(0);
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('sets the refresh cookie and wraps a successful login', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'USER@EXAMPLE.COM', password: 'password', remember: true })
      .expect(200);

    expect(response.headers['set-cookie']?.[0]).toContain('edt_refresh=refresh-token-value-12345');
    expect(response.body.data.tokens.accessToken).toBe('access');
    expect(auth.login).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'user@example.com' }),
      expect.objectContaining({ ip: expect.any(String), userAgent: null }),
    );
  });

  it('rejects an invalid AI body through real DTO validation', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/ai/chat')
      .send({ message: '' })
      .expect(422);
    expect(response.body.code).toBe('VALIDATION_FAILED');
    expect(ai.chat).not.toHaveBeenCalled();
  });

  it('passes authenticated user and request id to the AI controller service', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/ai/chat')
      .send({ message: 'What is happening?', stream: false })
      .expect(201);
    expect(ai.chat).toHaveBeenCalledWith('user-1', expect.objectContaining({ message: 'What is happening?' }), 'e2e-request');
    expect(response.body.data.conversationId).toBe('conversation-1');
  });
});
