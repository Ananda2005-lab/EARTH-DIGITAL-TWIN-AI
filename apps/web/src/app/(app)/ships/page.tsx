import {
  formatCompact,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  type VesselKind,
  type VesselState,
} from '@edt/shared';
import { Ship } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { StatCard, StatCardSkeleton } from '@/components/data/stat-card';
import { PageContainer, PageHeader, Section } from '@/components/layout/page-header';
import { Badge, LiveBadge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { groupBy } from '@/lib/utils';
import { CHOKEPOINTS, getVessels } from '@/server/providers/maritime';

export const metadata: Metadata = {
  title: 'Ships',
  description: 'Live vessel traffic tracked from AIS position reports via AISStream.',
};

// The vessel feed reads a live upstream provider, so the page is rendered per
// request rather than prerendered at build time.
export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<VesselKind, string> = {
  cargo: 'Cargo',
  tanker: 'Tanker',
  passenger: 'Passenger',
  fishing: 'Fishing',
  tug: 'Tug',
  sailing: 'Sailing',
  high_speed: 'High speed',
  military: 'Military',
  pleasure: 'Pleasure',
  other: 'Other',
};

export default function ShipsPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow={<LiveBadge />}
        title="Ships"
        description="Vessel traffic tracked worldwide via AIS position reports relayed through AISStream, plus the strategic chokepoints that carry most of global seaborne trade."
      />

      <Suspense fallback={<ShipsSkeleton />}>
        <ShipsView />
      </Suspense>

      {/* Chokepoint data is bundled and always available, independent of live vessels. */}
      <ChokepointsPanel />
    </PageContainer>
  );
}

async function ShipsView() {
  const feed = await getVessels({ limit: 200 });

  const byKind = groupBy(feed.vessels, (v) => v.kind);
  const topKinds = Object.entries(byKind)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 4);

  return (
    <>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Vessels tracked"
          value={formatCompact(feed.total)}
          icon={<Ship />}
          hint={feed.attribution}
        />
        {topKinds.map(([kind, vessels]) => (
          <StatCard
            key={kind}
            label={KIND_LABEL[kind as VesselKind]}
            value={formatCompact(vessels.length)}
          />
        ))}
      </div>

      {feed.total === 0 ? (
        <Card className="mb-8 p-10 text-center">
          <p className="display-tight text-base">AIS relay not configured on the gateway</p>
          <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
            Live AIS tracking needs an AISStream API key configured on the gateway. Attribution:{' '}
            {feed.attribution}.
          </p>
        </Card>
      ) : (
        <Section
          title="Vessel traffic"
          description={`${formatNumber(Math.min(30, feed.vessels.length))} of ${formatNumber(feed.total)} tracked vessels, sorted by speed · fetched ${formatRelativeTime(feed.fetchedAt)}`}
        >
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-border/60 border-b text-left text-xs">
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-3 py-3 font-medium">Kind</th>
                    <th className="px-3 py-3 text-right font-medium">Speed</th>
                    <th className="px-5 py-3 font-medium">Destination</th>
                  </tr>
                </thead>
                <tbody className="divide-border/60 divide-y">
                  {[...feed.vessels]
                    .sort((a, b) => (b.sog ?? 0) - (a.sog ?? 0))
                    .slice(0, 30)
                    .map((vessel) => (
                      <VesselRow key={vessel.mmsi} vessel={vessel} />
                    ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </Section>
      )}
    </>
  );
}

function VesselRow({ vessel }: { vessel: VesselState }) {
  return (
    <tr>
      <td className="px-5 py-2.5 font-medium">{vessel.name ?? vessel.mmsi}</td>
      <td className="px-3 py-2.5">
        <Badge variant="neutral">{KIND_LABEL[vessel.kind]}</Badge>
      </td>
      <td className="numeric px-3 py-2.5 text-right">
        {vessel.sog === null ? '—' : `${formatNumber(vessel.sog, 1)} kn`}
      </td>
      <td className="text-muted-foreground truncate px-5 py-2.5">{vessel.destination ?? '—'}</td>
    </tr>
  );
}

function ChokepointsPanel() {
  return (
    <Section
      title="Strategic chokepoints"
      description="Straits and canals that carry a disproportionate share of global seaborne trade."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CHOKEPOINTS.map((chokepoint) => (
          <Card key={chokepoint.id} className="p-4">
            <p className="truncate text-sm font-medium">{chokepoint.name}</p>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Daily transits</span>
              <span className="numeric font-medium">{formatNumber(chokepoint.dailyTransits)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Global trade share</span>
              <span className="numeric font-medium">
                {formatPercent(chokepoint.globalTradeSharePct, 0)}
              </span>
            </div>
            <p className="text-muted-foreground text-2xs mt-3 leading-relaxed">{chokepoint.note}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

function ShipsSkeleton() {
  return (
    <>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
      <Card className="p-5">
        <Skeleton className="h-5 w-40" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 10 }, (_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
      </Card>
    </>
  );
}
