import { Paginated, resolveSort } from './pagination';

<<<<<<< HEAD
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
=======
describe('Paginated.skipTake', () => {
  it('computes skip/take for a 1-based page', () => {
    expect(Paginated.skipTake({ page: 3, pageSize: 10 })).toEqual({ skip: 20, take: 10 });
  });

  it('falls back for non-finite or non-positive input', () => {
    expect(Paginated.skipTake({ page: 0, pageSize: 0 })).toEqual({ skip: 0, take: 24 });
    expect(Paginated.skipTake({ page: Number.NaN, pageSize: -5 })).toEqual({ skip: 0, take: 24 });
  });

  it('floors fractional pages', () => {
    expect(Paginated.skipTake({ page: 2.9, pageSize: 8.5 })).toEqual({ skip: 8, take: 8 });
  });
});

describe('Paginated.of', () => {
  it('builds a complete page contract', () => {
    const result = Paginated.of(['a', 'b'], 50, { page: 2, pageSize: 10 });
    expect(result).toEqual({
      items: ['a', 'b'],
      page: 2,
      pageSize: 10,
      total: 50,
      totalPages: 5,
>>>>>>> 005c357b565eaf6ff99b0cc04ff8ed07cf1d64a0
      hasNext: true,
      hasPrevious: true,
    });
  });

<<<<<<< HEAD
  it('slices materialised arrays and handles empty results', () => {
    expect(Paginated.slice([1, 2, 3, 4], { page: 2, pageSize: 2 }).items).toEqual([3, 4]);
    expect(Paginated.empty({ page: 1, pageSize: 10 })).toMatchObject({
      items: [], total: 0, totalPages: 0, hasNext: false, hasPrevious: false,
    });
=======
  it('flags the last page', () => {
    const result = Paginated.of([], 5, { page: 1, pageSize: 10 });
    expect(result.hasNext).toBe(false);
    expect(result.hasPrevious).toBe(false);
    expect(result.totalPages).toBe(1);
  });

  it('handles an empty dataset', () => {
    const result = Paginated.of<unknown>([], 0, { page: 1, pageSize: 24 });
    expect(result.totalPages).toBe(0);
    expect(result.hasNext).toBe(false);
  });
});

describe('Paginated.slice', () => {
  it('pages an in-memory array', () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    const page2 = Paginated.slice(items, { page: 2, pageSize: 10 });
    expect(page2.items).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(page2.total).toBe(25);
>>>>>>> 005c357b565eaf6ff99b0cc04ff8ed07cf1d64a0
  });
});

describe('resolveSort', () => {
  const allowed = ['name', 'createdAt'] as const;

<<<<<<< HEAD
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
=======
  it('honours allow-listed fields and direction', () => {
    expect(resolveSort(allowed, 'createdAt', 'name', 'asc')).toEqual({
      field: 'name',
      direction: 'asc',
    });
  });

  it('falls back for unknown fields', () => {
    expect(resolveSort(allowed, 'createdAt', 'evil; DROP TABLE')).toEqual({
      field: 'createdAt',
      direction: 'desc',
    });
  });

  it('normalises any direction to asc/desc', () => {
    expect(resolveSort(allowed, 'name', 'createdAt', 'sideways' as 'asc').direction).toBe('desc');
  });
>>>>>>> 005c357b565eaf6ff99b0cc04ff8ed07cf1d64a0
});
