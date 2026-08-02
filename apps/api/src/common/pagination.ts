import type { PaginatedResult, SortSpec } from '@edt/shared';

export interface PageRequest {
  page: number;
  pageSize: number;
}

export interface SkipTake {
  skip: number;
  take: number;
}

/**
 * Single place where page maths happens, so every list endpoint returns exactly
 * the same `PaginatedResult<T>` contract the web tier expects.
 */
export const Paginated = {
  /** Prisma `skip`/`take` for a 1-based page request. */
  skipTake({ page, pageSize }: PageRequest): SkipTake {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 24;
    return { skip: (safePage - 1) * safeSize, take: safeSize };
  },

  of<T>(items: T[], total: number, request: PageRequest): PaginatedResult<T> {
    const page = Number.isFinite(request.page) && request.page > 0 ? Math.floor(request.page) : 1;
    const pageSize =
      Number.isFinite(request.pageSize) && request.pageSize > 0 ? Math.floor(request.pageSize) : 24;
    const safeTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
    const totalPages = safeTotal === 0 ? 0 : Math.ceil(safeTotal / pageSize);

    return {
      items,
      page,
      pageSize,
      total: safeTotal,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1 && totalPages > 0,
    };
  },

  empty<T>(request: PageRequest): PaginatedResult<T> {
    return Paginated.of<T>([], 0, request);
  },

  /** Page an already-materialised array (used for upstream-sourced lists). */
  slice<T>(items: T[], request: PageRequest): PaginatedResult<T> {
    const { skip, take } = Paginated.skipTake(request);
    return Paginated.of(items.slice(skip, skip + take), items.length, request);
  },
};

/**
 * Translate `sortBy`/`sortDir` query parameters into a Prisma `orderBy`, refusing
 * any field that is not explicitly allow-listed by the caller.
 */
export function resolveSort<TField extends string>(
  allowed: readonly TField[],
  fallback: TField,
  sortBy?: string,
  sortDir: 'asc' | 'desc' = 'desc',
): SortSpec & { field: TField } {
  const field = allowed.find((candidate) => candidate === sortBy) ?? fallback;
  return { field, direction: sortDir === 'asc' ? 'asc' : 'desc' };
}
