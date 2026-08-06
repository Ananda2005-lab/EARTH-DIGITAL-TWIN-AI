import type { Metadata } from 'next';

import { MapShell } from '@/components/map/map-shell';
import { getHazardFeed } from '@/server/providers/hazards';
import { getFlights, MAJOR_AIRPORTS } from '@/server/providers/flights';
import { getVessels, SEAPORTS } from '@/server/providers/maritime';
import { getIssState, getIssTrack } from '@/server/providers/space';

export const metadata: Metadata = {
  title: '2D Map',
  description: 'Planar mission view with live hazards, radar, flights, ships and infrastructure.',
};

// Live upstream feeds (hazards, ADS-B, AIS, ISS) are fetched per request, so the
// map is rendered dynamically rather than prerendered at build time.
export const dynamic = 'force-dynamic';

export default async function MapPage() {
  const [hazardFeed, flightFeed, vesselFeed, issState, issTrack] = await Promise.all([
    getHazardFeed({ hours: 48, minSeverity: 'low', limit: 400 }),
    getFlights({ limit: 500 }),
    getVessels({ limit: 1000 }),
    getIssState(),
    getIssTrack(90),
  ]);

  return (
    <div className="fixed inset-0 lg:relative lg:inset-auto lg:h-[calc(100dvh-3.5rem)]">
      <MapShell
        data={{
          hazards: hazardFeed.events,
          flights: flightFeed.flights,
          vessels: vesselFeed.vessels,
          iss: issState ? { position: issState.position, name: 'ISS' } : null,
          issTrack: issTrack.map((point) => point.position),
          airports: MAJOR_AIRPORTS,
          seaports: SEAPORTS,
        }}
      />
    </div>
  );
}
