import {
  countryCodeToFlagEmoji,
  formatRelativeTime,
  type Bookmark,
  type BookmarkCollection,
  type PaginatedResult,
} from '@edt/shared';
import { MapPin, Pin, Route, Square, Tag as TagIcon, Telescope } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { RequireAuthNotice } from '@/components/data/require-auth-notice';
import { PageContainer, PageHeader, Section } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils';

import { NewBookmarkDialog } from './new-bookmark-dialog';

export const metadata: Metadata = {
  title: 'Saved Places',
  description:
    'Collections of places, views and areas of interest — bookmarked places, views, areas and routes, organised into collections.',
};

// Reads the signed-in user's bookmarks, which is per-request data.
export const dynamic = 'force-dynamic';

const KIND_ICON = { place: MapPin, view: Telescope, area: Square, route: Route } as const;
const KIND_LABEL = { place: 'Place', view: 'View', area: 'Area', route: 'Route' } as const;

interface SamplePlace {
  id: string;
  name: string;
  countryCode: string;
  lat: number;
  lng: number;
  savedAt: string;
}

const SAMPLE_PLACES: SamplePlace[] = [
  {
    id: 'sample-1',
    name: 'Kyoto',
    countryCode: 'JP',
    lat: 35.0116,
    lng: 135.7681,
    savedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sample-2',
    name: 'Reykjavík',
    countryCode: 'IS',
    lat: 64.1466,
    lng: -21.9426,
    savedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sample-3',
    name: 'Cape Town',
    countryCode: 'ZA',
    lat: -33.9249,
    lng: 18.4241,
    savedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sample-4',
    name: 'Queenstown',
    countryCode: 'NZ',
    lat: -45.0312,
    lng: 168.6626,
    savedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sample-5',
    name: 'Marrakesh',
    countryCode: 'MA',
    lat: 31.6295,
    lng: -7.9811,
    savedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sample-6',
    name: 'Ushuaia',
    countryCode: 'AR',
    lat: -54.8019,
    lng: -68.303,
    savedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

interface BookmarksData {
  bookmarks: PaginatedResult<Bookmark>;
  collections: BookmarkCollection[];
}

async function loadBookmarks(collectionId?: string): Promise<BookmarksData | null> {
  try {
    const [bookmarks, collections] = await Promise.all([
      api<PaginatedResult<Bookmark>>('/bookmarks', {
        query: { pageSize: 60, collectionId, sortDir: 'desc' },
      }),
      api<BookmarkCollection[]>('/bookmarks/collections'),
    ]);
    return { bookmarks, collections };
  } catch {
    // Unauthorised, gateway unreachable, or anything else — the page still
    // has to render, so the caller falls back to the sign-in notice.
    return null;
  }
}

export default async function BookmarksPage({
  searchParams,
}: {
  searchParams: { collection?: string };
}) {
  const activeCollection = searchParams.collection;
  const data = await loadBookmarks(activeCollection);

  return (
    <PageContainer>
      <PageHeader
        eyebrow={data ? <Badge variant="primary">{data.bookmarks.total} saved</Badge> : undefined}
        title="Saved Places"
        description="Everywhere you have pinned on the globe, grouped into collections you control."
        actions={data ? <NewBookmarkDialog collections={data.collections} /> : undefined}
      />

      {!data ? (
        <RequireAuthNotice description="Sign in to save places." />
      ) : (
        <>
          {data.collections.length > 0 ? (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <Link
                href="/bookmarks"
                className={cn(
                  'focus-visible:ring-ring rounded-full outline-none focus-visible:ring-2',
                )}
              >
                <Badge variant={activeCollection ? 'neutral' : 'primary'}>All</Badge>
              </Link>
              {data.collections.map((collection) => (
                <Link
                  key={collection.id}
                  href={`/bookmarks?collection=${collection.id}`}
                  className="focus-visible:ring-ring rounded-full outline-none focus-visible:ring-2"
                >
                  <Badge variant={activeCollection === collection.id ? 'primary' : 'neutral'}>
                    <span
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: collection.color }}
                      aria-hidden
                    />
                    {collection.name}
                    <span className="text-muted-foreground">{collection.bookmarkCount}</span>
                  </Badge>
                </Link>
              ))}
            </div>
          ) : null}

          {data.bookmarks.items.length === 0 ? (
            <Card className="p-10 text-center">
              <p className="display-tight text-base">No bookmarks yet</p>
              <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
                Save a place, view, area or route from anywhere on the globe and it will show up
                here.
              </p>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.bookmarks.items.map((bookmark) => (
                <BookmarkTile key={bookmark.id} bookmark={bookmark} />
              ))}
            </div>
          )}
        </>
      )}

      {!data ? <BookmarksPreviewSection /> : null}
    </PageContainer>
  );
}

function BookmarkTile({ bookmark }: { bookmark: Bookmark }) {
  const Icon = KIND_ICON[bookmark.kind];
  return (
    <Card className="h-full p-4">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${bookmark.color}22`, color: bookmark.color }}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-medium">{bookmark.name}</p>
            {bookmark.pinned ? (
              <Pin className="text-warning size-3.5 shrink-0 fill-current" aria-hidden />
            ) : null}
          </div>
          <p className="text-muted-foreground truncate text-xs">
            {bookmark.description ??
              `${bookmark.center.lat.toFixed(2)}, ${bookmark.center.lng.toFixed(2)}`}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <Badge variant="neutral">{KIND_LABEL[bookmark.kind]}</Badge>
        {bookmark.tags.length > 0 ? (
          <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
            <TagIcon className="size-3" aria-hidden />
            {bookmark.tags.slice(0, 2).join(', ')}
            {bookmark.tags.length > 2 ? ` +${bookmark.tags.length - 2}` : ''}
          </span>
        ) : null}
      </div>
    </Card>
  );
}

/**
 * Sample-data walkthrough shown only when signed out, so signed-in users see
 * only their real data — none of this is fetched.
 */
function BookmarksPreviewSection() {
  return (
    <Section
      title="What this looks like"
      description="Sample saved places with coordinates, country flags and when each was saved."
      actions={<Badge variant="secondary">Preview</Badge>}
      className="mt-10"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {SAMPLE_PLACES.map((place) => (
          <Card key={place.id} className="h-full p-4">
            <div className="flex items-center gap-2">
              <span className="text-lg leading-none" aria-hidden>
                {countryCodeToFlagEmoji(place.countryCode)}
              </span>
              <p className="truncate text-sm font-medium">{place.name}</p>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              {place.lat.toFixed(2)}, {place.lng.toFixed(2)}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Saved {formatRelativeTime(place.savedAt)}
            </p>
          </Card>
        ))}
      </div>
    </Section>
  );
}
