import { AuthService } from './auth.service';

const context = { ip: '127.0.0.1', userAgent: 'jest' };

function buildService() {
  const prisma = {
    user: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), update: jest.fn() },
    emailVerificationToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    passwordResetToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    oAuthAccount: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const tokens = {
    issue: jest.fn(), rotate: jest.fn(), revokeByToken: jest.fn(), revokeAllForUser: jest.fn(),
    listSessions: jest.fn(), revokeSession: jest.fn(),
  };
  const mfa = { verifyForLogin: jest.fn() };
  const mail = { sendVerification: jest.fn(), sendPasswordReset: jest.fn(), sendPasswordChanged: jest.fn() };
  const audit = { record: jest.fn() };
  const config = { get: jest.fn((key: string) => key === 'security' ? {
    bcryptCost: 4, emailVerifyTtlHours: 24, passwordResetTtlMinutes: 30,
    maxFailedLogins: 5, loginLockMinutes: 15,
  } : undefined) };
  return {
    service: new AuthService(prisma as never, tokens as never, mfa as never, mail as never, audit as never, config as never),
    prisma, tokens, mfa, mail, audit,
  };
}

describe('AuthService', () => {
  it('rejects registration when the email already exists', async () => {
    const { service, prisma } = buildService();
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(service.register({
      email: 'person@example.com', password: 'StrongPassword1!', name: 'Person',
      acceptTerms: true, marketingOptIn: false,
    }, context)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('returns the same unauthorised error for an unknown account', async () => {
    const { service, prisma, audit } = buildService();
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.login({ email: 'missing@example.com', password: 'wrong', remember: true }, context))
      .rejects.toMatchObject({ code: 'UNAUTHORISED' });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'failure' }));
  });

  it('revokes a supplied token and audits an authenticated logout', async () => {
    const { service, tokens, audit } = buildService();
    await service.logout('refresh-token', 'user-1', context);

    expect(tokens.revokeByToken).toHaveBeenCalledWith('refresh-token', 'logout');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'user-1', action: 'auth.logout',
    }));
  });

  it('silently accepts resend verification for unknown email addresses', async () => {
    const { service, prisma, mail } = buildService();
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.resendVerification('missing@example.com')).resolves.toBeUndefined();
    expect(mail.sendVerification).not.toHaveBeenCalled();
  });

  it('prevents unlinking the only sign-in method', async () => {
    const { service, prisma } = buildService();
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      passwordHash: null,
      oauthAccounts: [{ provider: 'google' }],
    });

    await expect(service.unlinkProvider('user-1', 'google'))
      .rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prisma.oAuthAccount.deleteMany).not.toHaveBeenCalled();
  });
});
