import { Paginated, resolveSort } from './pagination';

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
      hasNext: true,
      hasPrevious: true,
    });
  });

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
  });
});

describe('resolveSort', () => {
  const allowed = ['name', 'createdAt'] as const;

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
});
