import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { compare, hash } from 'bcryptjs';
import type { AuthProviderKind, Prisma } from '@prisma/client';
import type { AuthSession, LoginInput, RegisterInput, UserProfile } from '@edt/shared';
import type { AppConfig } from 'src/config/configuration';
import { AppException } from 'src/common/errors/app-exception';
import { randomToken, sha256 } from 'src/common/crypto/crypto.util';
import { AuditService } from 'src/infra/audit/audit.service';
import { MailService } from 'src/infra/mail/mail.service';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { toUserProfile } from '../users/user.mapper';
import { MfaService } from './mfa.service';
import { TokenService, type RequestContextInfo, type SessionSummary } from './token.service';

export interface OAuthProfileInput {
  provider: Extract<AuthProviderKind, 'google' | 'github'>;
  providerAccountId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  displayName: string | null;
}

const USER_INCLUDE = { oauthAccounts: { select: { provider: true } } } satisfies Prisma.UserInclude;

/**
 * Email/password and OAuth authentication, account recovery and session control.
 *
 * Password hashes use bcrypt at the configured cost (12 by default), single-use
 * secrets are stored as SHA-256 hashes, and every failure path is deliberately
 * indistinguishable to the caller so the endpoint cannot be used to enumerate
 * accounts.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly mfa: MfaService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async register(input: RegisterInput, context: RequestContextInfo): Promise<AuthSession> {
    const security = this.config.get('security', { infer: true });
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) throw AppException.conflict('An account with this email already exists');

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        organisation: input.organisation ?? null,
        marketingOptIn: input.marketingOptIn,
        acceptedTermsAt: new Date(),
        passwordHash: await hash(input.password, security.bcryptCost),
        status: 'unverified',
        preference: { create: {} },
        notificationPreference: { create: {} },
      },
      include: USER_INCLUDE,
    });

    await this.sendVerificationEmail(user.id, user.email, user.name);
    await this.audit.record({
      actorId: user.id,
      actorEmail: user.email,
      action: 'auth.register',
      resource: 'user',
      resourceId: user.id,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    const issued = await this.tokens.issue(
      { id: user.id, email: user.email, role: user.role, plan: user.plan },
      context,
    );
    return this.toSession(toUserProfile(user), issued);
  }

  async login(input: LoginInput, context: RequestContextInfo): Promise<AuthSession> {
    const security = this.config.get('security', { infer: true });
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: USER_INCLUDE,
    });

    // Constant-ish work regardless of whether the account exists.
    const passwordHash =
      user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    const passwordMatches = await compare(input.password, passwordHash);

    if (!user || !user.passwordHash || !passwordMatches) {
      if (user) await this.registerFailedLogin(user.id, user.failedLoginCount, security);
      await this.audit.record({
        actorId: user?.id ?? null,
        actorEmail: input.email,
        action: 'auth.login',
        resource: 'user',
        resourceId: user?.id ?? null,
        outcome: 'failure',
        ip: context.ip,
        userAgent: context.userAgent,
      });
      throw AppException.unauthorised('Email or password is incorrect');
    }

    if (user.deletedAt) throw AppException.unauthorised('Email or password is incorrect');
    if (user.status === 'suspended') throw AppException.forbidden('This account is suspended');
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw AppException.forbidden('Too many failed attempts. Try again later.', {
        retryAt: user.lockedUntil.toISOString(),
      });
    }

    if (user.mfaEnabled) await this.mfa.verifyForLogin(user.id, input.mfaCode);

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastSeenAt: new Date(),
      },
      include: USER_INCLUDE,
    });

    await this.audit.record({
      actorId: user.id,
      actorEmail: user.email,
      action: 'auth.login',
      resource: 'user',
      resourceId: user.id,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    const issued = await this.tokens.issue(
      { id: user.id, email: user.email, role: user.role, plan: user.plan },
      context,
    );
    return this.toSession(toUserProfile(updated), issued);
  }

  async refresh(refreshToken: string, context: RequestContextInfo): Promise<AuthSession> {
    const issued = await this.tokens.rotate(refreshToken, context);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: issued.userId },
      include: USER_INCLUDE,
    });
    return this.toSession(toUserProfile(user), issued);
  }

  async logout(
    refreshToken: string | undefined,
    userId: string | null,
    context: RequestContextInfo,
  ): Promise<void> {
    if (refreshToken) await this.tokens.revokeByToken(refreshToken, 'logout');
    if (userId) {
      await this.audit.record({
        actorId: userId,
        action: 'auth.logout',
        resource: 'user',
        resourceId: userId,
        ip: context.ip,
        userAgent: context.userAgent,
      });
    }
  }

  async sendVerificationEmail(userId: string, email: string, name: string): Promise<void> {
    const security = this.config.get('security', { infer: true });
    const token = randomToken();
    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        email,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + security.emailVerifyTtlHours * 3_600_000),
      },
    });
    await this.mail.sendVerification(email, name, token);
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Silent success: never reveal whether the address is registered.
    if (!user || user.emailVerified) return;
    await this.sendVerificationEmail(user.id, user.email, user.name);
  }

  async verifyEmail(token: string): Promise<UserProfile> {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw AppException.badRequest('This verification link is invalid or has expired');
    }

    const [, user] = await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: true, emailVerifiedAt: new Date(), status: 'active' },
        include: USER_INCLUDE,
      }),
    ]);

    return toUserProfile(user);
  }

  async forgotPassword(email: string, context: RequestContextInfo): Promise<void> {
    const security = this.config.get('security', { infer: true });
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt) return;

    const token = randomToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + security.passwordResetTtlMinutes * 60_000),
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
      },
    });
    await this.mail.sendPasswordReset(user.email, user.name, token);
  }

  async resetPassword(token: string, password: string, context: RequestContextInfo): Promise<void> {
    const security = this.config.get('security', { infer: true });
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw AppException.badRequest('This reset link is invalid or has expired');
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: record.userId } });
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await hash(password, security.bcryptCost),
          failedLoginCount: 0,
          lockedUntil: null,
        },
      }),
    ]);

    // A password change invalidates every existing session.
    await this.tokens.revokeAllForUser(user.id, { reason: 'password_reset' });
    await this.mail.sendPasswordChanged(user.email, user.name);
    await this.audit.record({
      actorId: user.id,
      actorEmail: user.email,
      action: 'auth.password_reset',
      resource: 'user',
      resourceId: user.id,
      ip: context.ip,
      userAgent: context.userAgent,
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    keepSessionId: string | null,
    context: RequestContextInfo,
  ): Promise<void> {
    const security = this.config.get('security', { infer: true });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash)
      throw AppException.badRequest('This account signs in with a social provider');
    if (!(await compare(currentPassword, user.passwordHash))) {
      throw AppException.unauthorised('Current password is incorrect');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hash(newPassword, security.bcryptCost) },
    });
    await this.tokens.revokeAllForUser(userId, {
      exceptSessionId: keepSessionId,
      reason: 'password_changed',
    });
    await this.mail.sendPasswordChanged(user.email, user.name);
    await this.audit.record({
      actorId: userId,
      actorEmail: user.email,
      action: 'auth.password_change',
      resource: 'user',
      resourceId: userId,
      ip: context.ip,
      userAgent: context.userAgent,
    });
  }

  /**
   * OAuth sign-in. Links to an existing account when the verified provider email
   * already exists, otherwise provisions a verified account (the provider has
   * already proven ownership of the address).
   */
  async loginWithOAuth(
    profile: OAuthProfileInput,
    context: RequestContextInfo,
  ): Promise<AuthSession> {
    const linked = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
        },
      },
      include: { user: { include: USER_INCLUDE } },
    });

    let user = linked?.user ?? null;

    if (!user) {
      const byEmail = await this.prisma.user.findUnique({
        where: { email: profile.email },
        include: USER_INCLUDE,
      });
      user =
        byEmail ??
        (await this.prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
            emailVerified: true,
            emailVerifiedAt: new Date(),
            status: 'active',
            acceptedTermsAt: new Date(),
            preference: { create: {} },
            notificationPreference: { create: {} },
          },
          include: USER_INCLUDE,
        }));

      await this.prisma.oAuthAccount.upsert({
        where: { userId_provider: { userId: user.id, provider: profile.provider } },
        create: {
          userId: user.id,
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
          email: profile.email,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          lastLoginAt: new Date(),
        },
        update: { providerAccountId: profile.providerAccountId, lastLoginAt: new Date() },
      });
    } else {
      await this.prisma.oAuthAccount.update({
        where: {
          provider_providerAccountId: {
            provider: profile.provider,
            providerAccountId: profile.providerAccountId,
          },
        },
        data: { lastLoginAt: new Date() },
      });
    }

    if (user.status === 'suspended') throw AppException.forbidden('This account is suspended');

    const refreshed = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastSeenAt: new Date() },
      include: USER_INCLUDE,
    });

    await this.audit.record({
      actorId: user.id,
      actorEmail: user.email,
      action: `auth.oauth.${profile.provider}`,
      resource: 'user',
      resourceId: user.id,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    const issued = await this.tokens.issue(
      { id: refreshed.id, email: refreshed.email, role: refreshed.role, plan: refreshed.plan },
      context,
    );
    return this.toSession(toUserProfile(refreshed), issued);
  }

  async unlinkProvider(userId: string, provider: 'google' | 'github'): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { oauthAccounts: true },
    });
    const remaining = user.oauthAccounts.filter((account) => account.provider !== provider);
    if (!user.passwordHash && remaining.length === 0) {
      throw AppException.conflict('Set a password before unlinking your only sign-in method');
    }
    await this.prisma.oAuthAccount.deleteMany({ where: { userId, provider } });
  }

  async listSessions(userId: string, currentSessionId: string | null): Promise<SessionSummary[]> {
    return this.tokens.listSessions(userId, currentSessionId);
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.tokens.revokeSession(userId, sessionId);
  }

  async revokeOtherSessions(userId: string, currentSessionId: string | null): Promise<number> {
    return this.tokens.revokeAllForUser(userId, {
      exceptSessionId: currentSessionId,
      reason: 'revoked_others',
    });
  }

  private async registerFailedLogin(
    userId: string,
    currentCount: number,
    security: AppConfig['security'],
  ): Promise<void> {
    const failedLoginCount = currentCount + 1;
    const shouldLock = failedLoginCount >= security.maxFailedLogins;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount,
        lockedUntil: shouldLock ? new Date(Date.now() + security.loginLockMinutes * 60_000) : null,
      },
    });
    if (shouldLock)
      this.logger.warn(`Account ${userId} locked after ${failedLoginCount} failed attempts`);
  }

  private toSession(
    user: UserProfile,
    issued: { accessToken: string; refreshToken: string; expiresIn: number },
  ): AuthSession {
    return {
      user,
      tokens: {
        accessToken: issued.accessToken,
        refreshToken: issued.refreshToken,
        expiresIn: issued.expiresIn,
        tokenType: 'Bearer',
      },
    };
  }
}
