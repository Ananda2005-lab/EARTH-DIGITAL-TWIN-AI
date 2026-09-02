import { CountriesService } from './countries.service';

function buildService() {
  const prisma = {
    country: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    city: { findMany: jest.fn() },
    countryIndicator: { findMany: jest.fn(), upsert: jest.fn() },
  };
  const upstream = { get: jest.fn() };
  return {
    service: new CountriesService(prisma as never, upstream as never),
    prisma,
    upstream,
  };
}

describe('CountriesService', () => {
  it('normalises the country code to uppercase before lookup', async () => {
    const { service, prisma } = buildService();
    prisma.country.findUnique.mockResolvedValue(null);

    await expect(service.summary('in')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(prisma.country.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: 'IN' } }),
    );
  });

  it('throws NOT_FOUND for an unknown country code', async () => {
    const { service, prisma } = buildService();
    prisma.country.findUnique.mockResolvedValue(null);

    await expect(service.summary('XX')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects an unknown indicator code before touching the database', async () => {
    const { service, prisma } = buildService();

    await expect(service.indicatorSeries('IN', 'not-an-indicator', 10))
      .rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(prisma.country.findUnique).not.toHaveBeenCalled();
  });
});
