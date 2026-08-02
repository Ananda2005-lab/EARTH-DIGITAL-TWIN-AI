import {
  formatCompact,
  formatNumber,
  formatRelativeTime,
  type HazardEvent,
  type HazardKind,
} from '@edt/shared';
import { ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { HazardKindIcon, SeverityBadge } from '@/components/data/severity-badge';
import { PageContainer, PageHeader, Section } from '@/components/layout/page-header';
import { Badge, LiveBadge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getHazardFeed } from '@/server/providers/hazards';

export const metadata: Metadata = {
  title: 'Hazard Monitor',
  description:
    'Live earthquakes, wildfires, volcanoes, floods, cyclones and droughts fused from USGS, NASA and GDACS.',
};

export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<HazardKind, string> = {
  earthquake: 'Earthquakes',
  wildfire: 'Wildfires',
  volcano: 'Volcanoes',
  flood: 'Floods',
  cyclone: 'Cyclones',
  drought: 'Droughts',
  landslide: 'Landslides',
  tsunami: 'Tsunamis',
};

export default function HazardsPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow={<LiveBadge />}
        title="Hazard Monitor"
        description="Multi-provider fusion with de-duplication across USGS, NASA EONET, NASA FIRMS and GDACS. A dead upstream degrades one row, never the page."
      />

      <Suspense fallback={<HazardsSkeleton />}>
        <HazardsView />
      </Suspense>
    </PageContainer>
  );
}

async function HazardsView() {
  const feed = await getHazardFeed({ hours: 72, limit: 500 });

  const byKind = new Map<HazardKind, HazardEvent[]>();
  for (const event of feed.events) {
    const bucket = byKind.get(event.kind) ?? [];
    bucket.push(event);
    byKind.set(event.kind, bucket);
  }

  const groups = [...byKind.entries()].sort((a, b) => b[1].length - a[1].length);
  const severe = feed.events.filter(
    (event) => event.severity === 'high' || event.severity === 'extreme',
  );

  if (feed.events.length === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="display-tight text-base">No active hazards reported</p>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
          Either the planet is unusually calm, or every upstream provider is unavailable.
          Attribution: {feed.attribution}.
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {groups.slice(0, 4).map(([kind, events]) => (
          <Card key={kind} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="stat-label">{KIND_LABEL[kind]}</span>
              <HazardKindIcon kind={kind} className="text-primary" />
            </div>
            <p className="stat-value mt-2">{formatCompact(events.length)}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {formatNumber(
                events.filter((e) => e.severity === 'high' || e.severity === 'extreme').length,
              )}{' '}
              severe
            </p>
          </Card>
        ))}
      </div>

      {severe.length > 0 ? (
        <Section
          title="Requires attention"
          description={`${formatNumber(severe.length)} events at high or extreme severity in the last 72 hours.`}
        >
          <Card>
            <CardContent className="p-0">
              <ul className="divide-border/60 divide-y">
                {severe.slice(0, 20).map((event) => (
                  <HazardRow key={event.id} event={event} />
                ))}
              </ul>
            </CardContent>
          </Card>
        </Section>
      ) : null}

      {groups.map(([kind, events]) => (
        <Section
          key={kind}
          title={KIND_LABEL[kind]}
          description={`${formatNumber(events.length)} events · ${events[0]?.source ?? feed.attribution}`}
        >
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Most recent</CardTitle>
              <Badge variant="neutral">{formatNumber(events.length)}</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-border/60 divide-y">
                {events.slice(0, 10).map((event) => (
                  <HazardRow key={event.id} event={event} />
                ))}
              </ul>
            </CardContent>
          </Card>
        </Section>
      ))}

      <p className="text-muted-foreground mt-2 text-xs">
        {formatNumber(feed.total)} events matched · fetched {formatRelativeTime(feed.fetchedAt)} ·{' '}
        {feed.attribution}
      </p>
    </>
  );
}

function HazardRow({ event }: { event: HazardEvent }) {
  const metrics = [
    event.magnitude !== undefined ? `M${event.magnitude.toFixed(1)}` : null,
    event.depthKm !== undefined ? `${formatNumber(event.depthKm)} km deep` : null,
    event.frpMw !== undefined ? `${formatNumber(event.frpMw)} MW` : null,
    event.affectedPopulation !== undefined
      ? `${formatCompact(event.affectedPopulation)} affected`
      : null,
  ].filter((entry): entry is string => entry !== null);

  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <span className="bg-surface-muted text-muted-foreground mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg">
        <HazardKindIcon kind={event.kind} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{event.title}</p>
        <p className="text-muted-foreground mt-0.5 truncate text-xs">
          {event.place ?? `${event.location.lat.toFixed(2)}, ${event.location.lng.toFixed(2)}`}
          {' · '}
          {formatRelativeTime(event.startedAt)}
          {metrics.length > 0 ? ` · ${metrics.join(' · ')}` : ''}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <SeverityBadge severity={event.severity} />
        {event.sourceUrl ? (
          <a
            href={event.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded p-1 outline-none transition-colors focus-visible:ring-2"
            aria-label={`Open source report for ${event.title}`}
          >
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : null}
      </div>
    </li>
  );
}

function HazardsSkeleton() {
  return (
    <>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} className="p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-7 w-16" />
            <Skeleton className="mt-2 h-3 w-14" />
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <Skeleton className="h-5 w-32" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    </>
  );
}
