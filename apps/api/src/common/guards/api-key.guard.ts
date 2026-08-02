import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { sha256 } from '../crypto/crypto.util';
import { AppException } from '../errors/app-exception';

export const API_KEY_HEADER = 'x-api-key';

/**
 * Machine authentication. The presented secret is hashed and looked up by hash —
 * the plaintext never exists in the database, and no comparison happens in JS.
 *
 * Attach with `@UseGuards(ApiKeyGuard)`; the resulting principal satisfies
 * `JwtAuthGuard` so key-based and token-based callers share the same handlers.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<Request>();

    const presented = request.header(API_KEY_HEADER);
    if (!presented) throw AppException.unauthorised('An API key is required for this endpoint');

    const record = await this.prisma.apiKey.findUnique({
      where: { keyHash: sha256(presented) },
      include: { owner: { select: { id: true, email: true, name: true, role: true, plan: true, status: true, emailVerified: true, mfaEnabled: true } } },
    });

    if (!record || record.revokedAt) throw AppException.unauthorised('API key is not valid');
    if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
      throw AppException.unauthorised('API key has expired');
    }
    if (record.owner.status === 'suspended') throw AppException.forbidden('The key owner is suspended');

    request.user = {
      id: record.owner.id,
      email: record.owner.email,
      name: record.owner.name,
      role: record.owner.role,
      plan: record.owner.plan,
      emailVerified: record.owner.emailVerified,
      mfaEnabled: record.owner.mfaEnabled,
      sessionId: null,
      apiKeyId: record.id,
      scopes: record.scopes,
      kind: 'api-key',
    };

    // Usage accounting must never block the request.
    void this.prisma.apiKey
      .update({
        where: { id: record.id },
        data: {
          lastUsedAt: new Date(),
          lastUsedIp: request.ip ?? null,
          usageCount: { increment: 1 },
        },
      })
      .catch(() => undefined);

    return true;
  }
}
