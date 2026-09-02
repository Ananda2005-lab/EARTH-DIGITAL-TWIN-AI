import { UsersService } from './users.service';

function buildService() {
  const prisma = {
    user: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
    historyEntry: { findMany: jest.fn(), count: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
  };
  const tokens = { revokeAllForUser: jest.fn() };
  return {
    service: new UsersService(prisma as never, tokens as never),
    prisma,
    tokens,
  };
}

describe('UsersService', () => {
  it('returns NOT_FOUND for a missing profile', async () => {
    const { service, prisma } = buildService();
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.profile('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('treats a soft-deleted account as missing', async () => {
    const { service, prisma } = buildService();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', deletedAt: new Date() });

    await expect(service.profile('u1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('refuses to close the platform owner account', async () => {
    const { service, prisma } = buildService();
    prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'owner-1', role: 'owner' });

    await expect(service.closeAccount('owner-1')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('returns the number of cleared history entries', async () => {
    const { service, prisma } = buildService();
    prisma.historyEntry.deleteMany.mockResolvedValue({ count: 3 });

    await expect(service.clearHistory('u1')).resolves.toBe(3);
    expect(prisma.historyEntry.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', kind: undefined },
    });
  });
});
