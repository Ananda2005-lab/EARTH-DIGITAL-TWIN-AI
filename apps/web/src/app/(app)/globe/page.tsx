import type { Metadata } from 'next';

import { GlobeShell } from '@/components/globe/globe-shell';
import { getHazardFeed } from '@/server/providers/hazards';

export const metadata: Metadata = {
  title: '3D Globe',
  description: 'Immersive digital twin with live hazards, borders and satellite imagery at 60 fps.',
};

// The hazard feed backing the initial marker set is live upstream data, so
// the globe is rendered per request rather than prerendered at build time.
export const dynamic = 'force-dynamic';

export default async function GlobePage() {
  const feed = await getHazardFeed({ hours: 48, minSeverity: 'moderate', limit: 300 });

  return (
    <div className="fixed inset-0 lg:relative lg:inset-auto lg:h-[calc(100dvh-3.5rem)]">
      <GlobeShell initialHazards={feed.events} />
    </div>
  );
}
