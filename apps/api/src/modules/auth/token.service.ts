import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type { SubscriptionPlan, UserRole } from '@edt/shared';
import type { AppConfig } from 'src/config/configuration';
import { AppException } from 'src/common/errors/app-exception';
import { randomToken, sha256 } from 'src/common/crypto/crypto.util';
import type { AccessTokenPayload } from 'src/common/types/authenticated-user';
import { PrismaService } from 'src/infra/prisma/prisma.service';

export interface TokenSubject {
  id: string;
  email: string;
  role: UserRole;
  plan: SubscriptionPlan;
}

export interface RequestContextInfo {
  ip?: string | null;
  userAgent?: string | null;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  userId: string;
  sessionId: string;
  familyId: string;
}

export interface SessionSummary {
  id: string;
  current: boolean;
  ip: string | null;
  userAgent: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  lastActiveAt: string;
  expiresAt: string;
  createdAt: string;
}

/** `15m`, `900s`, `2h`, `1d` → seconds. */
export function parseDuration(input: string): number {
  const match = /^(\d+)\s*([smhd])?$/iu.exec(input.trim());
  if (!match) return 900;
  const value = Number.parseInt(match[1] ?? '900', 10);
  switch ((match[2] ?? 's').toLowerCase()) {
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86_400;
    default:
      return value;
  }
}

/**
 * Access + refresh token lifecycle.
 *
 * Refresh tokens are opaque 48-byte secrets stored only as SHA-256 hashes and
 * rotated on every use. Each login starts a *family*; presenting a token that
 * was already consumed (or revoked) is treated as theft and revokes the whole
 * family, forcing re-authentication on every device using that chain.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  get accessTokenTtlSeconds(): number {
    return parseDuration(this.config.get('jwt', { infer: true }).accessTtl);
  }

  /** Start a new session (login / OAuth / registration). */
  async issue(subject: TokenSubject, context: RequestContextInfo = {}): Promise<IssuedTokens> {
    const jwtConfig = this.config.get('jwt', { infer: true });
    const familyId = randomUUID();
    const expiresAt = new Date(Date.now() + jwtConfig.refreshTtlDays * 86_400_000);
    const agent = parseUserAgent(context.userAgent ?? null);

    const session = await this.prisma.session.create({
      data: {
        userId: subject.id,
        familyId,
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
        device: agent.device,
        browser: agent.browser,
        os: agent.os,
        current: true,
        expiresAt,
      },
    });

    return this.mint(subject, session.id, familyId, expiresAt, context, null);
  }

  /**
   * Exchange a refresh token for a new pair.
   * Throws `UNAUTHORISED` for unknown/expired tokens and revokes the family on
   * replay of an already-rotated token.
   */
  async rotate(presentedToken: string, context: RequestContextInfo = {}): Promise<IssuedTokens> {
    const tokenHash = sha256(presentedToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: { id: true, email: true, role: true, plan: true, status: true, deletedAt: true },
        },
      },
    });

    if (!record) throw AppException.unauthorised('Refresh token is not recognised');

    if (record.usedAt || record.revokedAt) {
      await this.revokeFamily(
        record.familyId,
        record.usedAt ? 'reuse_detected' : 'revoked_token_replayed',
      );
      this.logger.warn(
        `Refresh token reuse detected for family ${record.familyId}; family revoked`,
      );
      throw AppException.unauthorised('Refresh token has already been used; sign in again');
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      await this.prisma.refreshToken.update({
        where: { id: record.id },
        data: { revokedAt: new Date(), revokedReason: 'expired' },
      });
      throw AppException.unauthorised('Refresh token has expired');
    }

    if (record.user.deletedAt || record.user.status === 'suspended') {
      await this.revokeFamily(record.familyId, 'account_unavailable');
      throw AppException.forbidden('This account is not active');
    }

    const session = record.sessionId
      ? await this.prisma.session.findUnique({ where: { id: record.sessionId } })
      : null;
    if (session?.revokedAt) {
      await this.revokeFamily(record.familyId, 'session_revoked');
      throw AppException.unauthorised('Session has been revoked');
    }

    const issued = await this.mint(
      {
        id: record.user.id,
        email: record.user.email,
        role: record.user.role,
        plan: record.user.plan,
      },
      record.sessionId,
      record.familyId,
      record.expiresAt,
      context,
      record.id,
    );

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { usedAt: new Date(), replacedById: issued.refreshTokenId },
    });

    if (record.sessionId) {
      await this.prisma.session.update({
        where: { id: record.sessionId },
        data: { lastActiveAt: new Date(), ip: context.ip ?? undefined },
      });
    }

    return issued;
  }

  /** Sign out: consume the presented token and close its session. */
  async revokeByToken(presentedToken: string, reason = 'logout'): Promise<void> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(presentedToken) },
    });
    if (!record) return;
    await this.revokeFamily(record.familyId, reason);
  }

  async revokeFamily(familyId: string, reason: string): Promise<number> {
    const now = new Date();
    const [tokens] = await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { familyId, revokedAt: null },
        data: { revokedAt: now, revokedReason: reason },
      }),
      this.prisma.session.updateMany({
        where: { familyId, revokedAt: null },
        data: { revokedAt: now, current: false },
      }),
    ]);
    return tokens.count;
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    reason = 'revoked_by_user',
  ): Promise<void> {
    const session = await this.prisma.session.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw AppException.notFound('Session not found');
    await this.revokeFamily(session.familyId, reason);
  }

  /** Revoke everything, optionally keeping the caller's current session alive. */
  async revokeAllForUser(
    userId: string,
    options: { exceptSessionId?: string | null; reason?: string } = {},
  ): Promise<number> {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        ...(options.exceptSessionId ? { id: { not: options.exceptSessionId } } : {}),
      },
      select: { familyId: true },
    });
    let revoked = 0;
    for (const session of sessions) {
      revoked += await this.revokeFamily(session.familyId, options.reason ?? 'revoked_all');
    }
    return revoked;
  }

  async listSessions(userId: string, currentSessionId: string | null): Promise<SessionSummary[]> {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastActiveAt: 'desc' },
    });
    return sessions.map((session) => ({
      id: session.id,
      current: session.id === currentSessionId,
      ip: session.ip,
      userAgent: session.userAgent,
      device: session.device,
      browser: session.browser,
      os: session.os,
      lastActiveAt: session.lastActiveAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
    }));
  }

  private async mint(
    subject: TokenSubject,
    sessionId: string | null,
    familyId: string,
    familyExpiresAt: Date,
    context: RequestContextInfo,
    parentId: string | null,
  ): Promise<IssuedTokens & { refreshTokenId: string }> {
    const jwtConfig = this.config.get('jwt', { infer: true });
    const jti = randomUUID();
    const payload: AccessTokenPayload = {
      sub: subject.id,
      email: subject.email,
      role: subject.role,
      plan: subject.plan,
      sid: sessionId,
      jti,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: jwtConfig.accessSecret,
      expiresIn: jwtConfig.accessTtl,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
      jwtid: jti,
    });

    const refreshToken = randomToken(48);
    const created = await this.prisma.refreshToken.create({
      data: {
        userId: subject.id,
        sessionId,
        familyId,
        parentId,
        tokenHash: sha256(refreshToken),
        expiresAt: familyExpiresAt,
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
      },
      select: { id: true },
    });

    return {
      accessToken,
      refreshToken,
      refreshTokenId: created.id,
      expiresIn: this.accessTokenTtlSeconds,
      tokenType: 'Bearer',
      userId: subject.id,
      sessionId: sessionId ?? '',
      familyId,
    };
  }
}

interface AgentInfo {
  device: string | null;
  browser: string | null;
  os: string | null;
}

/** Coarse UA classification — enough for the "your sessions" list, no library. */
export function parseUserAgent(userAgent: string | null): AgentInfo {
  if (!userAgent) return { device: null, browser: null, os: null };
  const ua = userAgent.toLowerCase();
  const browser = ua.includes('edg/')
    ? 'Edge'
    : ua.includes('chrome/') && !ua.includes('chromium')
      ? 'Chrome'
      : ua.includes('safari/') && !ua.includes('chrome/')
        ? 'Safari'
        : ua.includes('firefox/')
          ? 'Firefox'
          : null;
  const os = ua.includes('windows')
    ? 'Windows'
    : ua.includes('mac os')
      ? 'macOS'
      : ua.includes('android')
        ? 'Android'
        : ua.includes('iphone') || ua.includes('ipad')
          ? 'iOS'
          : ua.includes('linux')
            ? 'Linux'
            : null;
  const device = ua.includes('mobile')
    ? 'Mobile'
    : ua.includes('tablet') || ua.includes('ipad')
      ? 'Tablet'
      : 'Desktop';
  return { device, browser, os };
}
