import { formatCoordinates, formatDistance, formatNumber, formatRelativeTime } from '@edt/shared';
import { Radio, Rocket, Satellite } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { StatCard, StatCardSkeleton } from '@/components/data/stat-card';
import { PageContainer, PageHeader, Section } from '@/components/layout/page-header';
import { LiveBadge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getIssState, getSatelliteGroups, getSpaceWeather } from '@/server/providers/space';

import { KpIndexChart } from './kp-index-chart';

export const metadata: Metadata = {
  title: 'Space Weather',
  description: 'Live geomagnetic conditions from NOAA SWPC, ISS position and satellite catalogue.',
};

// Every panel reads a live upstream feed, so the page is rendered per request
// rather than prerendered at build time.
export const dynamic = 'force-dynamic';

export default function SpacePage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow={<LiveBadge />}
        title="Space Weather"
        description="Geomagnetic activity, the International Space Station and the tracked satellite catalogue."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Suspense fallback={<StatCardSkeleton />}>
          <KpStat />
        </Suspense>
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<PanelSkeleton />}>
          <SpaceWeatherPanel />
        </Suspense>
        <Suspense fallback={<PanelSkeleton />}>
          <IssPanel />
        </Suspense>
      </div>

      <Suspense fallback={<GroupsSkeleton />}>
        <SatelliteGroupsPanel />
      </Suspense>
    </PageContainer>
  );
}

/** `minor_storm` reads badly in a UI; the enum stays machine-friendly instead. */
function humanKpBand(band: string): string {
  return band.replace(/_/g, ' ');
}

async function KpStat() {
  const space = await getSpaceWeather();
  const disturbed = space.kpIndex >= 5;
  return (
    <StatCard
      label="Geomagnetic Kp"
      value={space.kpIndex.toFixed(1)}
      unit={humanKpBand(space.kpBand)}
      icon={<Radio />}
      intent={disturbed ? 'warning' : 'positive'}
      hint={`Aurora above ${formatNumber(space.auroraVisibleAboveLat, 1)}° lat`}
    />
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
      value:
        space.solarWindDensity === null ? '—' : `${formatNumber(space.solarWindDensity, 1)} p/cm³`,
    },
    { label: 'Bz', value: space.bz === null ? '—' : `${formatNumber(space.bz, 1)} nT` },
    {
      label: 'Radio flux (F10.7)',
      value: space.radioFlux === null ? '—' : `${formatNumber(space.radioFlux)} sfu`,
    },
    {
      label: 'Sunspot number',
      value: space.sunspotNumber === null ? '—' : formatNumber(space.sunspotNumber),
    },
    { label: 'Aurora above', value: `${formatNumber(space.auroraVisibleAboveLat, 1)}° lat` },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Space weather</CardTitle>
        <p className="text-muted-foreground text-xs">
          {space.attribution} · observed {formatRelativeTime(space.observedAt)}
        </p>
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
        {space.series.length > 0 ? (
          <div className="border-border/60 mt-4 border-t pt-4">
            <p className="stat-label mb-2">Kp index over time</p>
            <KpIndexChart series={space.series} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

async function IssPanel() {
  const iss = await getIssState();

  if (!iss) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>International Space Station</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-muted-foreground py-8 text-center text-sm">
            ISS position is temporarily unavailable.
          </p>
        </CardContent>
      </Card>
    );
  }

  const rows: { label: string; value: string }[] = [
    { label: 'Position', value: formatCoordinates(iss.position.lng, iss.position.lat) },
    { label: 'Altitude', value: formatDistance(iss.altitudeKm * 1000) },
    { label: 'Velocity', value: `${formatNumber(iss.velocityKmh)} km/h` },
    { label: 'Footprint', value: formatDistance(iss.footprintKm * 1000) },
    { label: 'Visibility', value: iss.visibility },
  ];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>International Space Station</CardTitle>
          <p className="text-muted-foreground mt-1 text-xs">
            WhereTheISS.at · updated {formatRelativeTime(iss.timestamp)}
          </p>
        </div>
        <Rocket className="text-primary size-4 shrink-0" aria-hidden />
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
      </CardContent>
    </Card>
  );
}

async function SatelliteGroupsPanel() {
  const groups = await getSatelliteGroups();

  return (
    <Section
      title="Satellite catalogue"
      description="Tracked constellations sourced from CelesTrak TLE sets."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {groups.map((group) => (
          <Card key={group.id} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="stat-label">{group.label}</span>
              <Satellite className="text-primary size-4 shrink-0" aria-hidden />
            </div>
            <p className="stat-value mt-2">{formatNumber(group.count)}</p>
            <p className="text-muted-foreground mt-1 text-xs">{group.description}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

function PanelSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-56" />
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-8 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

function GroupsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <Card key={index} className="p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-7 w-16" />
          <Skeleton className="mt-2 h-3 w-24" />
        </Card>
      ))}
    </div>
  );
}
