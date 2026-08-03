import {
  formatBearing,
  formatCompact,
  formatDistance,
  formatNumber,
  formatRelativeTime,
  formatSpeed,
  type FlightPhase,
  type FlightState,
} from '@edt/shared';
import { Plane } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { StatCard, StatCardSkeleton } from '@/components/data/stat-card';
import { PageContainer, PageHeader, Section } from '@/components/layout/page-header';
import { Badge, LiveBadge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { findNearestAirports, getFlights, MAJOR_AIRPORTS } from '@/server/providers/flights';

export const metadata: Metadata = {
  title: 'Flights',
  description: 'Live airborne traffic tracked from OpenSky Network ADS-B state vectors.',
};

// The flight feed reads a live upstream provider, so the page is rendered per
// request rather than prerendered at build time.
export const dynamic = 'force-dynamic';

const PHASE_LABEL: Record<FlightPhase, string> = {
  ground: 'Ground',
  climb: 'Climb',
  cruise: 'Cruise',
  descent: 'Descent',
  unknown: 'Unknown',
};

const PHASE_VARIANT: Record<FlightPhase, 'neutral' | 'primary' | 'success' | 'warning'> = {
  ground: 'neutral',
  climb: 'success',
  cruise: 'primary',
  descent: 'warning',
  unknown: 'neutral',
};

export default function FlightsPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow={<LiveBadge />}
        title="Flights"
        description="Airborne aircraft tracked worldwide via ADS-B state vectors from the OpenSky Network."
      />

      <Suspense fallback={<FlightsSkeleton />}>
        <FlightsView />
      </Suspense>
    </PageContainer>
  );
}

async function FlightsView() {
  const feed = await getFlights({ limit: 200 });

  if (feed.total === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="display-tight text-base">OpenSky credentials not configured on the gateway</p>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
          Live ADS-B tracking needs OpenSky Network credentials configured on the server.
          Attribution: {feed.attribution}.
        </p>
      </Card>
    );
  }

  const byPhase = countByPhase(feed.flights);
  const sortedFlights = [...feed.flights]
    .sort((a, b) => (b.altitude ?? 0) - (a.altitude ?? 0))
    .slice(0, 30);
  const nearestMajorAirports = findNearestAirports({ lng: 77.209, lat: 28.6139 }, 5);

  return (
    <>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Total airborne"
          value={formatCompact(feed.total)}
          icon={<Plane />}
          hint={feed.attribution}
        />
        <StatCard label="Climbing" value={formatCompact(byPhase.climb)} intent="positive" />
        <StatCard label="Cruising" value={formatCompact(byPhase.cruise)} />
        <StatCard label="Descending" value={formatCompact(byPhase.descent)} intent="warning" />
        <StatCard label="On ground" value={formatCompact(byPhase.ground)} intent="neutral" />
      </div>

      <Section
        title="Airborne traffic"
        description={`${formatNumber(Math.min(30, sortedFlights.length))} of ${formatNumber(feed.total)} tracked aircraft, sorted by altitude · fetched ${formatRelativeTime(feed.fetchedAt)}`}
      >
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-border/60 border-b text-left text-xs">
                  <th className="px-5 py-3 font-medium">Callsign</th>
                  <th className="px-3 py-3 font-medium">Origin</th>
                  <th className="px-3 py-3 text-right font-medium">Altitude</th>
                  <th className="px-3 py-3 text-right font-medium">Speed</th>
                  <th className="px-3 py-3 font-medium">Heading</th>
                  <th className="px-5 py-3 font-medium">Phase</th>
                </tr>
              </thead>
              <tbody className="divide-border/60 divide-y">
                {sortedFlights.map((flight) => (
                  <FlightRow key={flight.icao24} flight={flight} />
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </Section>

      <Section
        title="Major airports nearby"
        description={`Closest of ${formatNumber(MAJOR_AIRPORTS.length)} bundled high-volume airports to the default view.`}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {nearestMajorAirports.map((airport) => (
            <Card key={airport.icao} className="p-4">
              <p className="truncate text-sm font-medium">{airport.name}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {airport.iata ?? airport.icao} · {airport.city ?? airport.countryCode}
              </p>
            </Card>
          ))}
        </div>
      </Section>
    </>
  );
}

function countByPhase(flights: FlightState[]): Record<FlightPhase, number> {
  const counts: Record<FlightPhase, number> = {
    ground: 0,
    climb: 0,
    cruise: 0,
    descent: 0,
    unknown: 0,
  };
  for (const flight of flights) counts[flight.phase] += 1;
  return counts;
}

function FlightRow({ flight }: { flight: FlightState }) {
  return (
    <tr>
      <td className="px-5 py-2.5 font-medium">{flight.callsign ?? flight.icao24}</td>
      <td className="text-muted-foreground truncate px-3 py-2.5">{flight.originCountry}</td>
      <td className="numeric px-3 py-2.5 text-right">{formatDistance(flight.altitude)}</td>
      <td className="numeric px-3 py-2.5 text-right">{formatSpeed(flight.velocity, 'metric')}</td>
      <td className="numeric px-3 py-2.5">{formatBearing(flight.heading)}</td>
      <td className="px-5 py-2.5">
        <Badge variant={PHASE_VARIANT[flight.phase]}>{PHASE_LABEL[flight.phase]}</Badge>
      </td>
    </tr>
  );
}

function FlightsSkeleton() {
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
