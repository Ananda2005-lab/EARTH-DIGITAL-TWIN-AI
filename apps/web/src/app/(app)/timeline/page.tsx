import type { Metadata } from 'next';

import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Historical Timeline',
  description: 'A curated timeline of major world, climate and space milestones.',
};

// A static curated list, so this renders once at build time.
export const revalidate = 86_400;

interface Milestone {
  year: string;
  title: string;
  description: string;
}

const MILESTONES: Milestone[] = [
  {
    year: '1957',
    title: 'Sputnik 1 launched',
    description:
      'The Soviet Union puts the first artificial satellite into orbit, opening the space age.',
  },
  {
    year: '1969',
    title: 'Apollo 11 Moon landing',
    description: 'Neil Armstrong and Buzz Aldrin become the first humans to walk on the Moon.',
  },
  {
    year: '1972',
    title: 'Landsat 1 launched',
    description: 'NASA begins the longest continuous space-based record of Earth\u2019s surface.',
  },
  {
    year: '1987',
    title: 'Montreal Protocol signed',
    description: 'Nations agree to phase out substances that deplete the ozone layer.',
  },
  {
    year: '1990',
    title: 'Hubble Space Telescope launched',
    description: 'A space-based observatory begins transforming astronomy and cosmology.',
  },
  {
    year: '1997',
    title: 'Kyoto Protocol adopted',
    description: 'The first major international treaty to commit to reducing greenhouse gases.',
  },
  {
    year: '2004',
    title: 'Indian Ocean earthquake and tsunami',
    description:
      'A magnitude 9.1 earthquake triggers one of the deadliest natural disasters on record.',
  },
  {
    year: '2015',
    title: 'Paris Agreement signed',
    description: '196 parties commit to holding global warming well below 2°C.',
  },
  {
    year: '2019',
    title: 'First image of a black hole',
    description:
      'The Event Horizon Telescope collaboration releases the first direct image of a black hole.',
  },
  {
    year: '2020',
    title: 'COVID-19 declared a pandemic',
    description:
      'The World Health Organization characterises the coronavirus outbreak as a global pandemic.',
  },
  {
    year: '2021',
    title: 'James Webb Space Telescope launched',
    description: 'The most powerful space telescope ever built begins probing the early universe.',
  },
  {
    year: '2023',
    title: 'Hottest year on record',
    description:
      'Global average temperatures reach the highest levels recorded since instrumental tracking began.',
  },
];

export default function TimelinePage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow={<Badge variant="warning">Beta</Badge>}
        title="Historical Timeline"
        description="A curated set of major world, climate and space milestones. This is a scoped-down v1 while the full historical imagery layer is built."
      />

      <Card className="mb-8 p-5">
        <p className="text-sm leading-relaxed">
          This view is a hand-picked list of notable events, not yet the imagery-scrubbing timeline
          described in the roadmap. More historical layers are coming soon.
        </p>
      </Card>

      <ol className="border-border/70 relative ml-3 border-l pl-8">
        {MILESTONES.map((milestone) => (
          <li key={milestone.year} className="relative mb-8 last:mb-0">
            <span
              className="border-background bg-primary shadow-glow absolute -left-[calc(2rem+5px)] top-1 size-3 rounded-full border-2"
              aria-hidden
            />
            <Card>
              <CardContent className="pt-5">
                <p className="numeric text-primary text-sm font-semibold tracking-wide">
                  {milestone.year}
                </p>
                <p className="display-tight mt-1 text-base">{milestone.title}</p>
                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                  {milestone.description}
                </p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </PageContainer>
  );
}
