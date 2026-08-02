import { Injectable } from '@nestjs/common';
import type {
  Bookmark as BookmarkRow,
  BookmarkCollection as CollectionRow,
  Prisma,
} from '@prisma/client';
import type {
  Bookmark,
  BookmarkCollection,
  CreateBookmarkInput,
  PaginatedResult,
  ViewState,
} from '@edt/shared';
import { AppException } from 'src/common/errors/app-exception';
import { Paginated, resolveSort } from 'src/common/pagination';
import { PrismaService } from 'src/infra/prisma/prisma.service';

export interface BookmarkListQuery {
  page: number;
  pageSize: number;
  q?: string;
  collectionId?: string;
  tag?: string;
  kind?: Bookmark['kind'];
  pinnedOnly?: boolean;
  sortBy?: string;
  sortDir: 'asc' | 'desc';
}

export interface CollectionInput {
  name: string;
  description?: string | null;
  color: string;
}

const SORTABLE = ['createdAt', 'updatedAt', 'name'] as const;

/** Saved places, views and areas, grouped into user-owned collections. */
@Injectable()
export class BookmarksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: BookmarkListQuery): Promise<PaginatedResult<Bookmark>> {
    const where: Prisma.BookmarkWhereInput = {
      userId,
      collectionId: query.collectionId,
      kind: query.kind,
      pinned: query.pinnedOnly ? true : undefined,
      tags: query.tag ? { has: query.tag } : undefined,
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { description: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const sort = resolveSort(SORTABLE, 'createdAt', query.sortBy, query.sortDir);
    const { skip, take } = Paginated.skipTake(query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.bookmark.findMany({
        where,
        orderBy: [{ pinned: 'desc' }, { [sort.field]: sort.direction }],
        skip,
        take,
      }),
      this.prisma.bookmark.count({ where }),
    ]);

    return Paginated.of(rows.map(toBookmark), total, query);
  }

  async get(userId: string, id: string): Promise<Bookmark> {
    const bookmark = await this.prisma.bookmark.findFirst({ where: { id, userId } });
    if (!bookmark) throw AppException.notFound('Bookmark not found');
    return toBookmark(bookmark);
  }

  async create(userId: string, input: CreateBookmarkInput): Promise<Bookmark> {
    if (input.collectionId) await this.assertCollection(userId, input.collectionId);

    const bookmark = await this.prisma.bookmark.create({
      data: {
        userId,
        collectionId: input.collectionId ?? null,
        name: input.name,
        description: input.description ?? null,
        kind: input.kind,
        lng: input.center.lng,
        lat: input.center.lat,
        view: input.view ?? undefined,
        bboxWest: input.bbox?.[0] ?? null,
        bboxSouth: input.bbox?.[1] ?? null,
        bboxEast: input.bbox?.[2] ?? null,
        bboxNorth: input.bbox?.[3] ?? null,
        countryCode: input.countryCode ?? null,
        tags: input.tags,
        color: input.color,
        pinned: input.pinned,
      },
    });
    return toBookmark(bookmark);
  }

  async update(userId: string, id: string, input: Partial<CreateBookmarkInput>): Promise<Bookmark> {
    await this.get(userId, id);
    if (input.collectionId) await this.assertCollection(userId, input.collectionId);

    const bookmark = await this.prisma.bookmark.update({
      where: { id },
      data: {
        collectionId: input.collectionId === undefined ? undefined : (input.collectionId ?? null),
        name: input.name,
        description: input.description === undefined ? undefined : (input.description ?? null),
        kind: input.kind,
        lng: input.center?.lng,
        lat: input.center?.lat,
        view: input.view ?? undefined,
        bboxWest: input.bbox?.[0],
        bboxSouth: input.bbox?.[1],
        bboxEast: input.bbox?.[2],
        bboxNorth: input.bbox?.[3],
        countryCode: input.countryCode === undefined ? undefined : (input.countryCode ?? null),
        tags: input.tags,
        color: input.color,
        pinned: input.pinned,
      },
    });
    return toBookmark(bookmark);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.get(userId, id);
    await this.prisma.bookmark.delete({ where: { id } });
  }

  async listCollections(userId: string): Promise<BookmarkCollection[]> {
    const rows = await this.prisma.bookmarkCollection.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { bookmarks: true } } },
    });
    return rows.map((row) => toCollection(row, row._count.bookmarks));
  }

  async createCollection(userId: string, input: CollectionInput): Promise<BookmarkCollection> {
    const existing = await this.prisma.bookmarkCollection.findFirst({
      where: { userId, name: input.name },
    });
    if (existing) throw AppException.conflict('A collection with that name already exists');

    const collection = await this.prisma.bookmarkCollection.create({
      data: {
        userId,
        name: input.name,
        description: input.description ?? null,
        color: input.color,
      },
    });
    return toCollection(collection, 0);
  }

  async updateCollection(
    userId: string,
    id: string,
    input: Partial<CollectionInput>,
  ): Promise<BookmarkCollection> {
    await this.assertCollection(userId, id);
    const collection = await this.prisma.bookmarkCollection.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description === undefined ? undefined : (input.description ?? null),
        color: input.color,
      },
      include: { _count: { select: { bookmarks: true } } },
    });
    return toCollection(collection, collection._count.bookmarks);
  }

  /** Deleting a collection keeps its bookmarks (they become uncategorised). */
  async removeCollection(userId: string, id: string): Promise<void> {
    await this.assertCollection(userId, id);
    await this.prisma.bookmarkCollection.delete({ where: { id } });
  }

  async tags(userId: string): Promise<{ tag: string; count: number }[]> {
    const rows = await this.prisma.bookmark.findMany({ where: { userId }, select: { tags: true } });
    const counts = new Map<string, number>();
    for (const row of rows) {
      for (const tag of row.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }

  private async assertCollection(userId: string, collectionId: string): Promise<void> {
    const collection = await this.prisma.bookmarkCollection.findFirst({
      where: { id: collectionId, userId },
    });
    if (!collection) throw AppException.notFound('Collection not found');
  }
}

function toBookmark(row: BookmarkRow): Bookmark {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description,
    kind: row.kind,
    center: { lng: row.lng, lat: row.lat },
    view: (row.view ?? null) as ViewState | null,
    bbox:
      row.bboxWest !== null &&
      row.bboxSouth !== null &&
      row.bboxEast !== null &&
      row.bboxNorth !== null
        ? [row.bboxWest, row.bboxSouth, row.bboxEast, row.bboxNorth]
        : null,
    countryCode: row.countryCode,
    tags: row.tags,
    color: row.color,
    collectionId: row.collectionId,
    pinned: row.pinned,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toCollection(row: CollectionRow, bookmarkCount: number): BookmarkCollection {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description,
    color: row.color,
    bookmarkCount,
    createdAt: row.createdAt.toISOString(),
  };
}
