import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { compare, hash } from 'bcryptjs';
import type { AppConfig } from 'src/config/configuration';
import { AppException } from 'src/common/errors/app-exception';
import { decryptSecret, encryptSecret } from 'src/common/crypto/crypto.util';
import {
  buildOtpAuthUri,
  DEFAULT_TOTP_OPTIONS,
  generateRecoveryCodes,
  generateTotpSecret,
  verifyTotp,
  type TotpOptions,
} from 'src/common/crypto/totp.util';
import { PrismaService } from 'src/infra/prisma/prisma.service';

export interface MfaEnrolment {
  secret: string;
  otpauthUri: string;
  recoveryCodes: string[];
}

/**
 * TOTP second factor.
 *
 * Seeds are encrypted at rest with AES-256-GCM, recovery codes are bcrypt-hashed
 * and single-use, and the counter of the last accepted step is persisted so the
 * same code cannot be replayed inside its 30-second window.
 */
@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private get options(): TotpOptions {
    return DEFAULT_TOTP_OPTIONS;
  }

  /** Step 1: create (or replace) an unconfirmed enrolment. */
  async beginEnrolment(userId: string, email: string): Promise<MfaEnrolment> {
    const security = this.config.get('security', { infer: true });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true },
    });
    if (!user) throw AppException.notFound('User not found');
    if (user.mfaEnabled)
      throw AppException.conflict('Multi-factor authentication is already enabled');

    const secret = generateTotpSecret();
    const recoveryCodes = generateRecoveryCodes();
    const recoveryHashes = await Promise.all(
      recoveryCodes.map((code) => hash(code, security.bcryptCost)),
    );

    await this.prisma.mfaSecret.upsert({
      where: { userId },
      create: {
        userId,
        secretEncrypted: encryptSecret(secret, security.mfaEncryptionKey),
        algorithm: this.options.algorithm,
        digits: this.options.digits,
        period: this.options.period,
        recoveryHashes,
      },
      update: {
        secretEncrypted: encryptSecret(secret, security.mfaEncryptionKey),
        recoveryHashes,
        confirmedAt: null,
        lastUsedCounter: null,
      },
    });

    return {
      secret,
      otpauthUri: buildOtpAuthUri({
        issuer: security.mfaIssuer,
        account: email,
        secret,
        options: this.options,
      }),
      recoveryCodes,
    };
  }

  /** Step 2: confirm enrolment with a live code, which switches MFA on. */
  async confirmEnrolment(userId: string, code: string): Promise<void> {
    const record = await this.prisma.mfaSecret.findUnique({ where: { userId } });
    if (!record) throw AppException.badRequest('Start multi-factor enrolment first');
    if (record.confirmedAt)
      throw AppException.conflict('Multi-factor authentication is already enabled');

    const verification = this.verifyAgainst(record.secretEncrypted, code, record);
    if (!verification.valid || verification.counter === null) {
      throw AppException.unauthorised('That code is not valid');
    }

    await this.prisma.$transaction([
      this.prisma.mfaSecret.update({
        where: { userId },
        data: {
          confirmedAt: new Date(),
          lastUsedAt: new Date(),
          lastUsedCounter: BigInt(verification.counter),
        },
      }),
      this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } }),
    ]);
  }

  /** Login-time check. Accepts a TOTP code or an unused recovery code. */
  async verifyForLogin(userId: string, code: string | undefined): Promise<void> {
    if (!code) throw AppException.unauthorised('A multi-factor code is required');
    const record = await this.prisma.mfaSecret.findUnique({ where: { userId } });
    if (!record?.confirmedAt)
      throw AppException.badRequest('Multi-factor authentication is not configured');

    const verification = this.verifyAgainst(record.secretEncrypted, code, record);
    if (verification.valid && verification.counter !== null) {
      if (
        record.lastUsedCounter !== null &&
        BigInt(verification.counter) <= record.lastUsedCounter
      ) {
        throw AppException.unauthorised('That code has already been used');
      }
      await this.prisma.mfaSecret.update({
        where: { userId },
        data: { lastUsedAt: new Date(), lastUsedCounter: BigInt(verification.counter) },
      });
      return;
    }

    const consumed = await this.consumeRecoveryCode(userId, code, record.recoveryHashes);
    if (!consumed) throw AppException.unauthorised('That code is not valid');
  }

  /** Disable MFA. Requires a valid current code to prevent lockout griefing. */
  async disable(userId: string, code: string): Promise<void> {
    const record = await this.prisma.mfaSecret.findUnique({ where: { userId } });
    if (!record?.confirmedAt)
      throw AppException.badRequest('Multi-factor authentication is not enabled');

    const verification = this.verifyAgainst(record.secretEncrypted, code, record);
    const recovered = verification.valid
      ? true
      : await this.consumeRecoveryCode(userId, code, record.recoveryHashes);
    if (!recovered) throw AppException.unauthorised('That code is not valid');

    await this.prisma.$transaction([
      this.prisma.mfaSecret.delete({ where: { userId } }),
      this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: false } }),
    ]);
  }

  async isEnabled(userId: string): Promise<boolean> {
    const record = await this.prisma.mfaSecret.findUnique({
      where: { userId },
      select: { confirmedAt: true },
    });
    return Boolean(record?.confirmedAt);
  }

  private verifyAgainst(
    encrypted: string,
    code: string,
    record: { algorithm: string; digits: number; period: number },
  ): { valid: boolean; counter: number | null } {
    const security = this.config.get('security', { infer: true });
    const secret = decryptSecret(encrypted, security.mfaEncryptionKey);
    const algorithm =
      record.algorithm === 'SHA256' || record.algorithm === 'SHA512' ? record.algorithm : 'SHA1';
    return verifyTotp(secret, code, {
      algorithm,
      digits: record.digits,
      period: record.period,
    });
  }

  private async consumeRecoveryCode(
    userId: string,
    code: string,
    hashes: string[],
  ): Promise<boolean> {
    const normalised = code.trim().toLowerCase();
    for (const candidate of hashes) {
      if (await compare(normalised, candidate)) {
        await this.prisma.mfaSecret.update({
          where: { userId },
          data: {
            recoveryHashes: hashes.filter((entry) => entry !== candidate),
            lastUsedAt: new Date(),
          },
        });
        return true;
      }
    }
    return false;
  }
}
