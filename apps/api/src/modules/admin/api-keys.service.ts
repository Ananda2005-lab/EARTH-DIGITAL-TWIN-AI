import { Injectable } from '@nestjs/common';
import type { ApiKey } from '@prisma/client';
import type { ApiKeyRecord } from '@edt/shared';
import { AppException } from 'src/common/errors/app-exception';
import { randomToken, sha256 } from 'src/common/crypto/crypto.util';
import { PrismaService } from 'src/infra/prisma/prisma.service';

export interface CreateApiKeyInput {
  name: string;
  scopes: string[];
  rateLimitPerMinute: number;
  expiresInDays?: number | null;
}

export interface IssuedApiKey {
  record: ApiKeyRecord;
  /** Returned exactly once — the plaintext is never stored or logged. */
  secret: string;
}

const KEY_PREFIX = 'edt';

/**
 * Machine credential lifecycle.
 *
 * Secrets are generated server-side, hashed with SHA-256 and stored hash-only.
 * Rotation issues a new secret and revokes the old row while keeping the audit
 * link (`rotatedFromId`) intact.
 */
@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async list(includeRevoked: boolean): Promise<ApiKeyRecord[]> {
    const rows = await this.prisma.apiKey.findMany({
      where: includeRevoked ? {} : { revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toApiKeyRecord);
  }

  async issue(ownerId: string, input: CreateApiKeyInput): Promise<IssuedApiKey> {
    const secret = `${KEY_PREFIX}_${randomToken(32)}`;
    const row = await this.prisma.apiKey.create({
      data: {
        ownerId,
        name: input.name,
        prefix: KEY_PREFIX,
        suffix: secret.slice(-6),
        keyHash: sha256(secret),
        scopes: input.scopes,
        rateLimitPerMinute: input.rateLimitPerMinute,
        expiresAt: input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86_400_000) : null,
      },
    });
    return { record: toApiKeyRecord(row), secret };
  }

  async rotate(id: string, actorId: string): Promise<IssuedApiKey> {
    const existing = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!existing) throw AppException.notFound('API key not found');
    if (existing.revokedAt) throw AppException.conflict('This key has already been revoked');

    const secret = `${KEY_PREFIX}_${randomToken(32)}`;
    const [, replacement] = await this.prisma.$transaction([
      this.prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } }),
      this.prisma.apiKey.create({
        data: {
          ownerId: actorId,
          name: existing.name,
          prefix: KEY_PREFIX,
          suffix: secret.slice(-6),
          keyHash: sha256(secret),
          scopes: existing.scopes,
          rateLimitPerMinute: existing.rateLimitPerMinute,
          expiresAt: existing.expiresAt,
          rotatedFromId: existing.id,
        },
      }),
    ]);

    return { record: toApiKeyRecord(replacement), secret };
  }

  async revoke(id: string): Promise<ApiKeyRecord> {
    const existing = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!existing) throw AppException.notFound('API key not found');
    if (existing.revokedAt) return toApiKeyRecord(existing);
    const revoked = await this.prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
    return toApiKeyRecord(revoked);
  }
}

function toApiKeyRecord(row: ApiKey): ApiKeyRecord {
  return {
    id: row.id,
    name: row.name,
    suffix: row.suffix,
    scopes: row.scopes,
    rateLimitPerMinute: row.rateLimitPerMinute,
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}
