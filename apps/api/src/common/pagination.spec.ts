import { Paginated, resolveSort } from './pagination';

describe('Paginated', () => {
  it('calculates Prisma skip/take for one-based pages', () => {
    expect(Paginated.skipTake({ page: 3, pageSize: 10 })).toEqual({ skip: 20, take: 10 });
  });

  it.each([
    [{ page: 0, pageSize: 0 }, { skip: 0, take: 24 }],
    [{ page: Number.NaN, pageSize: Number.POSITIVE_INFINITY }, { skip: 0, take: 24 }],
    [{ page: 2.9, pageSize: 5.8 }, { skip: 5, take: 5 }],
  ])('normalises unsafe page input', (input, expected) => {
    expect(Paginated.skipTake(input)).toEqual(expected);
  });

  it('builds complete pagination metadata', () => {
    expect(Paginated.of(['a', 'b'], 21, { page: 2, pageSize: 10 })).toEqual({
      items: ['a', 'b'],
      page: 2,
      pageSize: 10,
      total: 21,
      totalPages: 3,
      hasNext: true,
      hasPrevious: true,
    });
  });

  it('slices materialised arrays and handles empty results', () => {
    expect(Paginated.slice([1, 2, 3, 4], { page: 2, pageSize: 2 }).items).toEqual([3, 4]);
    expect(Paginated.empty({ page: 1, pageSize: 10 })).toMatchObject({
      items: [], total: 0, totalPages: 0, hasNext: false, hasPrevious: false,
    });
  });
});

describe('resolveSort', () => {
  const allowed = ['name', 'createdAt'] as const;

  it('accepts an allow-listed field and ascending direction', () => {
    expect(resolveSort(allowed, 'createdAt', 'name', 'asc')).toEqual({
      field: 'name', direction: 'asc',
    });
  });

  it('falls back for unknown fields and normalises direction', () => {
    expect(resolveSort(allowed, 'createdAt', 'password', 'desc')).toEqual({
      field: 'createdAt', direction: 'desc',
    });
  });
});
