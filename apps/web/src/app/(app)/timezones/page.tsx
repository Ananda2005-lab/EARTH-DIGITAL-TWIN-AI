import type { Metadata } from 'next';

import { MeetingPlanner } from '@/components/data/meeting-planner';
import { WorldClockGrid } from '@/components/data/world-clock-grid';
import { PageContainer, PageHeader, Section } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = {
  title: 'Time Zones',
  description: 'A live world clock and cross-timezone meeting planner with daylight-saving awareness.',
};

export default function TimezonesPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow={<Badge variant="primary">24 zones</Badge>}
        title="Time Zones"
        description="Local time in major cities across every UTC offset, updating every second — plus a meeting planner that finds the hours where everyone is actually awake."
      />

      <Section title="Meeting planner" description="Pick participants, set a proposed time, and see best overlap.">
        <MeetingPlanner />
      </Section>

      <Section title="World clock" description="Live local time and day/night status for every UTC offset.">
        <WorldClockGrid />
      </Section>
    </PageContainer>
  );
}
