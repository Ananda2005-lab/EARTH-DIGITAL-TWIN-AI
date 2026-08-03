import type { Metadata } from 'next';

import { WorldClockGrid } from '@/components/data/world-clock-grid';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = {
  title: 'Time Zones',
  description: 'A live world clock across 24 major time zones with day/night indicators.',
};

export default function TimezonesPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow={<Badge variant="primary">24 zones</Badge>}
        title="Time Zones"
        description="Local time in major cities across every UTC offset, updating every second. A meeting planner and DST tracker are next."
      />

      <WorldClockGrid />
    </PageContainer>
  );
}
