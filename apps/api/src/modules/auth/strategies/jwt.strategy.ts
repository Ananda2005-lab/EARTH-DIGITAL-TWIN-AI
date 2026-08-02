import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, type StrategyOptionsWithoutRequest } from 'passport-jwt';
import { AppException } from 'src/common/errors/app-exception';
import type { AccessTokenPayload, AuthenticatedUser } from 'src/common/types/authenticated-user';
import type { AppConfig } from 'src/config/configuration';
import { PrismaService } from 'src/infra/prisma/prisma.service';

/**
 * Verifies the bearer access token and re-reads the user, so a suspension, role
 * change or session revocation takes effect on the next request instead of
 * waiting for the 15-minute token to expire.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService,
  ) {
    const jwt = config.get('jwt', { infer: true });
    const options: StrategyOptionsWithoutRequest = {
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request) => {
          const cookies = (request as { cookies?: Record<string, string> }).cookies;
          return cookies?.edt_access ?? null;
        },
      ]),
      secretOrKey: jwt.accessSecret,
      issuer: jwt.issuer,
      audience: jwt.audience,
      ignoreExpiration: false,
    };
    super(options);
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        plan: true,
        status: true,
        emailVerified: true,
        mfaEnabled: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt) throw AppException.unauthorised('Account is no longer available');
    if (user.status === 'suspended') throw AppException.forbidden('This account is suspended');

    if (payload.sid) {
      const session = await this.prisma.session.findUnique({
        where: { id: payload.sid },
        select: { revokedAt: true, expiresAt: true },
      });
      if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
        throw AppException.unauthorised('Session has ended, sign in again');
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      plan: user.plan,
      emailVerified: user.emailVerified,
      mfaEnabled: user.mfaEnabled,
      sessionId: payload.sid,
      apiKeyId: null,
      scopes: [],
      kind: 'user',
    };
  }
}
