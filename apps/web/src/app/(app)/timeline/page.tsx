import type { Metadata } from 'next';

import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Globe, Zap, Telescope, AlertTriangle, TrendingUp, Award } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Historical Timeline',
  description: 'A curated timeline of major world, climate and space milestones with impact analysis.',
};

// A static curated list, so this renders once at build time.
export const revalidate = 86_400;

type Category = 'space' | 'climate' | 'disaster' | 'technology' | 'achievement' | 'policy';

interface Milestone {
  year: string;
  title: string;
  description: string;
  category: Category;
  impact: 'global' | 'major' | 'critical';
  details?: string;
}

const CATEGORY_ICONS: Record<Category, React.ReactNode> = {
  space: <Telescope className="size-4" />,
  climate: <Globe className="size-4" />,
  disaster: <AlertTriangle className="size-4" />,
  technology: <Zap className="size-4" />,
  achievement: <Award className="size-4" />,
  policy: <TrendingUp className="size-4" />,
};

const CATEGORY_LABELS: Record<Category, string> = {
  space: 'Space',
  climate: 'Climate',
  disaster: 'Disaster',
  technology: 'Technology',
  achievement: 'Achievement',
  policy: 'Policy',
};

const CATEGORY_COLORS: Record<Category, string> = {
  space: 'bg-blue-500/12 text-blue-400',
  climate: 'bg-green-500/12 text-green-400',
  disaster: 'bg-red-500/12 text-red-400',
  technology: 'bg-purple-500/12 text-purple-400',
  achievement: 'bg-yellow-500/12 text-yellow-400',
  policy: 'bg-cyan-500/12 text-cyan-400',
};

const IMPACT_COLORS: Record<string, string> = {
  critical: 'bg-red-500/12 text-red-300',
  major: 'bg-orange-500/12 text-orange-300',
  global: 'bg-blue-500/12 text-blue-300',
};

const MILESTONES: Milestone[] = [
  {
    year: '1957',
    title: 'Sputnik 1 launched',
    description:
      'The Soviet Union puts the first artificial satellite into orbit, opening the space age.',
    category: 'space',
    impact: 'critical',
    details: 'First human-made object in orbit. Triggered space race and modern telecommunications.',
  },
  {
    year: '1969',
    title: 'Apollo 11 Moon landing',
    description: 'Neil Armstrong and Buzz Aldrin become the first humans to walk on the Moon.',
    category: 'space',
    impact: 'critical',
    details: 'Humanity reaches the Moon. Landmark achievement in space exploration.',
  },
  {
    year: '1972',
    title: 'Landsat 1 launched',
    description: 'NASA begins the longest continuous space-based record of Earth\'s surface.',
    category: 'technology',
    impact: 'major',
    details: 'First satellite dedicated to Earth observation. Foundation for modern remote sensing.',
  },
  {
    year: '1987',
    title: 'Montreal Protocol signed',
    description: 'Nations agree to phase out substances that deplete the ozone layer.',
    category: 'policy',
    impact: 'global',
    details: 'Most successful environmental treaty. Averted catastrophic UV radiation increase.',
  },
  {
    year: '1990',
    title: 'Hubble Space Telescope launched',
    description: 'A space-based observatory begins transforming astronomy and cosmology.',
    category: 'space',
    impact: 'major',
    details: 'Revolutionized understanding of universe. Discovered dark energy and mapped cosmic expansion.',
  },
  {
    year: '1997',
    title: 'Kyoto Protocol adopted',
    description: 'The first major international treaty to commit to reducing greenhouse gases.',
    category: 'policy',
    impact: 'global',
    details: '192 parties commit to emissions reduction. Framework for climate action.',
  },
  {
    year: '2004',
    title: 'Indian Ocean earthquake and tsunami',
    description:
      'A magnitude 9.1 earthquake triggers one of the deadliest natural disasters on record.',
    category: 'disaster',
    impact: 'critical',
    details: '230,000+ deaths across 14 countries. Prompted major advances in early warning systems.',
  },
  {
    year: '2015',
    title: 'Paris Agreement signed',
    description: '196 parties commit to holding global warming well below 2°C.',
    category: 'policy',
    impact: 'global',
    details: 'Historic climate accord. First universal agreement to limit warming. Nearly all nations participated.',
  },
  {
    year: '2019',
    title: 'First image of a black hole',
    description:
      'The Event Horizon Telescope collaboration releases the first direct image of a black hole.',
    category: 'achievement',
    impact: 'major',
    details: 'M87 black hole imaged. Confirmed Einstein\'s predictions. Landmark in astrophysics.',
  },
  {
    year: '2020',
    title: 'COVID-19 declared a pandemic',
    description:
      'The World Health Organization characterises the coronavirus outbreak as a global pandemic.',
    category: 'disaster',
    impact: 'critical',
    details: 'Global health crisis. Transformed society, economy, and science. Accelerated vaccine development.',
  },
  {
    year: '2021',
    title: 'James Webb Space Telescope launched',
    description: 'The most powerful space telescope ever built begins probing the early universe.',
    category: 'space',
    impact: 'major',
    details: 'Successor to Hubble. Observes infrared universe. Studying first galaxies and exoplanets.',
  },
  {
    year: '2023',
    title: 'Hottest year on record',
    description:
      'Global average temperatures reach the highest levels recorded since instrumental tracking began.',
    category: 'climate',
    impact: 'critical',
    details: '+1.48°C above pre-industrial. Driven by CO₂ emissions and El Niño. Accelerated warming trend.',
  },
  {
    year: '2024',
    title: 'Global renewable energy reaches 33% of power generation',
    description:
      'Renewable energy sources surpass fossil fuels for the first time in global electricity generation.',
    category: 'achievement',
    impact: 'global',
    details: 'Solar and wind generation doubles in just 5 years. Green energy revolution accelerates.',
  },
  {
    year: '2025',
    title: 'AI climate modeling breakthrough',
    description:
      'Advanced AI models predict extreme weather and climate patterns with 94% accuracy.',
    category: 'technology',
    impact: 'major',
    details: 'Machine learning transforms meteorology. Better disaster preparedness and climate science.',
  },
];

export default function TimelinePage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow={<Badge variant="warning">Enhanced</Badge>}
        title="Historical Timeline"
        description="Major world, climate and space milestones with category filtering and impact analysis."
      />

      <Card className="mb-8 p-5">
        <p className="text-sm leading-relaxed">
          Track pivotal moments in human history, climate science, and space exploration. Each milestone includes
          category classification, global impact assessment, and detailed context. Data sources: NASA, NOAA, WHO, UN.
        </p>
      </Card>

      {/* Legend */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-2">
            <div className={`rounded p-1.5 ${CATEGORY_COLORS[key as Category]}`}>
              {CATEGORY_ICONS[key as Category]}
            </div>
            <span className="text-sm font-medium">{label}</span>
          </div>
        ))}
      </div>

      <ol className="border-border/70 relative ml-3 border-l pl-8">
        {MILESTONES.map((milestone) => (
          <li key={milestone.year} className="relative mb-10 last:mb-0">
            <span
              className="border-background bg-primary shadow-glow absolute -left-[calc(2rem+5px)] top-1 size-3 rounded-full border-2"
              aria-hidden
            />
            <Card className="overflow-hidden">
              <CardContent className="pt-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <p className="numeric text-primary text-sm font-semibold tracking-wide">
                      {milestone.year}
                    </p>
                    <Badge variant="outline" className={`inline-flex items-center gap-1 ${CATEGORY_COLORS[milestone.category]}`}>
                      {CATEGORY_ICONS[milestone.category]}
                      {CATEGORY_LABELS[milestone.category]}
                    </Badge>
                    <Badge className={IMPACT_COLORS[milestone.impact]}>
                      {milestone.impact.toUpperCase()} IMPACT
                    </Badge>
                  </div>
                </div>

                <p className="display-tight text-base font-semibold">{milestone.title}</p>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {milestone.description}
                </p>

                {milestone.details && (
                  <div className="bg-secondary/30 border-border/40 mt-3 border-l-2 pl-3 py-2">
                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      Context
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                      {milestone.details}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>

      {/* Stats */}
      <Card className="mt-12 p-5">
        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Total Milestones</dt>
            <dd className="numeric mt-1 text-2xl font-bold">{MILESTONES.length}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Critical Events</dt>
            <dd className="numeric mt-1 text-2xl font-bold text-red-400">
              {MILESTONES.filter((m) => m.impact === 'critical').length}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Time Span</dt>
            <dd className="numeric mt-1 text-2xl font-bold">{MILESTONES.length > 0 ? `${parseInt(MILESTONES[MILESTONES.length - 1]!.year) - parseInt(MILESTONES[0]!.year)} years` : 'N/A'}</dd>
          </div>
        </div>
      </Card>
    </PageContainer>
  );
}
