import { formatCompact, formatNumber, formatRelativeTime, NAV_ITEMS } from '@edt/shared';
import { Activity, Plane, Radio, Ship, TriangleAlert } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { HazardKindIcon, SeverityBadge } from '@/components/data/severity-badge';
import { StatCard, StatCardSkeleton } from '@/components/data/stat-card';
import { PageContainer, PageHeader, Section } from '@/components/layout/page-header';
import { NavIcon } from '@/components/nav-icon';
import { LiveBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getFlights } from '@/server/providers/flights';
import { getHazardFeed } from '@/server/providers/hazards';
import { getVessels } from '@/server/providers/maritime';
import { getSpaceWeather } from '@/server/providers/space';

export const metadata: Metadata = {
  title: 'Mission Control',
  description: 'Live planetary overview with hazard alerts, movement telemetry and space weather.',
};

// Every panel reads a live upstream feed, so the page is rendered per request
// rather than prerendered at build time.
export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow={<LiveBadge label="Streaming" />}
        title="Mission Control"
        description="One situation room for the planet: what is happening right now, where it is happening, and what it means."
        actions={
          <>
            <Button variant="glass" size="sm" asChild>
              <Link href="/globe">Open globe</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/ai">Ask the assistant</Link>
            </Button>
          </>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Suspense fallback={<StatCardSkeleton />}>
          <HazardStat />
        </Suspense>
        <Suspense fallback={<StatCardSkeleton />}>
          <FlightStat />
        </Suspense>
        <Suspense fallback={<StatCardSkeleton />}>
          <VesselStat />
        </Suspense>
        <Suspense fallback={<StatCardSkeleton />}>
          <SpaceWeatherStat />
        </Suspense>
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <Suspense fallback={<PanelSkeleton rows={6} className="lg:col-span-2" />}>
          <SignificantHazards />
        </Suspense>
        <Suspense fallback={<PanelSkeleton rows={4} />}>
          <SpaceWeatherPanel />
        </Suspense>
      </div>

      <Section title="Jump back in" description="Every module shares the same spatial context.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {NAV_ITEMS.filter((item) => item.group === 'explore' || item.group === 'monitor')
            .slice(0, 8)
            .map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="focus-visible:ring-ring rounded-2xl outline-none focus-visible:ring-2"
              >
                <Card interactive className="h-full p-4">
                  <div className="flex items-center gap-2.5">
                    <NavIcon name={item.icon} className="text-primary size-4 shrink-0" />
                    <span className="display-tight truncate text-sm">{item.label}</span>
                    {item.badge === 'live' ? <LiveBadge className="ml-auto" /> : null}
                  </div>
                  <p className="text-muted-foreground mt-2 line-clamp-2 text-xs leading-relaxed">
                    {item.description}
                  </p>
                </Card>
              </Link>
            ))}
        </div>
      </Section>
    </PageContainer>
  );
}

// ── Stat tiles ───────────────────────────────────────────────────────────────

async function HazardStat() {
  const feed = await getHazardFeed({ hours: 24, limit: 400 });
  const severe = feed.events.filter(
    (event) => event.severity === 'high' || event.severity === 'extreme',
  ).length;

  return (
    <StatCard
      label="Active hazards · 24 h"
      value={formatCompact(feed.total)}
      icon={<TriangleAlert />}
      intent={severe > 0 ? 'warning' : 'neutral'}
      trend={severe > 0 ? 'up' : 'flat'}
      trendLabel={`${formatNumber(severe)} severe`}
      hint={feed.attribution}
    />
  );
}

async function FlightStat() {
  const feed = await getFlights({ limit: 1 });
  return (
    <StatCard
      label="Aircraft airborne"
      value={formatCompact(feed.total)}
      icon={<Plane />}
      hint={feed.total === 0 ? 'OpenSky credentials not configured' : 'OpenSky Network · ADS-B'}
    />
  );
}

async function VesselStat() {
  const feed = await getVessels({ limit: 1 });
  return (
    <StatCard
      label="Vessels tracked"
      value={formatCompact(feed.total)}
      icon={<Ship />}
      hint={feed.total === 0 ? 'AISStream key not configured' : 'AISStream · AIS'}
    />
  );
}

async function SpaceWeatherStat() {
  const space = await getSpaceWeather();
  const disturbed = space.kpIndex >= 5;
  return (
    <StatCard
      label="Geomagnetic Kp"
      value={space.kpIndex.toFixed(1)}
      unit={humanKpBand(space.kpBand)}
      icon={<Radio />}
      intent={disturbed ? 'warning' : 'positive'}
      hint="NOAA SWPC"
    />
  );
}

/** `minor_storm` reads badly in a UI; the enum stays machine-friendly instead. */
function humanKpBand(band: string): string {
  return band.replace(/_/g, ' ');
}

// ── Panels ───────────────────────────────────────────────────────────────────

async function SignificantHazards() {
  const feed = await getHazardFeed({ hours: 48, minSeverity: 'moderate', limit: 12 });

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Significant events</CardTitle>
          <p className="text-muted-foreground mt-1 text-xs">
            Moderate and above, last 48 hours · {feed.attribution}
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/hazards">View all</Link>
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {feed.events.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No significant events reported in the last 48 hours.
          </p>
        ) : (
          <ul className="divide-border/60 divide-y">
            {feed.events.map((event) => (
              <li key={event.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span className="bg-surface-muted text-muted-foreground mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <HazardKindIcon kind={event.kind} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{event.title}</p>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {event.place ??
                      `${event.location.lat.toFixed(2)}, ${event.location.lng.toFixed(2)}`}
                    {' · '}
                    {formatRelativeTime(event.startedAt)}
                  </p>
                </div>
                <SeverityBadge severity={event.severity} className="mt-0.5 shrink-0" />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

async function SpaceWeatherPanel() {
  const space = await getSpaceWeather();

  const rows: { label: string; value: string }[] = [
    { label: 'Kp index', value: `${space.kpIndex.toFixed(1)} · ${humanKpBand(space.kpBand)}` },
    {
      label: 'Solar wind',
      value: space.solarWindSpeed === null ? '—' : `${formatNumber(space.solarWindSpeed)} km/s`,
    },
    {
      label: 'Wind density',
      value: space.solarWindDensity === null ? '—' : `${space.solarWindDensity.toFixed(1)} p/cm³`,
    },
    { label: 'Bz', value: space.bz === null ? '—' : `${space.bz.toFixed(1)} nT` },
    { label: 'Aurora above', value: `${space.auroraVisibleAboveLat.toFixed(1)}° lat` },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Space weather</CardTitle>
        <p className="text-muted-foreground text-xs">NOAA SWPC · updated every 15 minutes</p>
      </CardHeader>
      <CardContent className="pt-0">
        <dl className="divide-border/60 divide-y">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-muted-foreground text-xs">{row.label}</dt>
              <dd className="numeric text-sm">{row.value}</dd>
            </div>
          ))}
        </dl>
        <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
          <Link href="/space">
            <Activity />
            Space weather detail
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function PanelSkeleton({ rows, className }: { rows: number; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-56" />
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
