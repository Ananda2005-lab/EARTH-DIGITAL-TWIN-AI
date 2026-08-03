import { formatCompact, type Continent } from '@edt/shared';
import { ArrowUpRight, Compass } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PageContainer, PageHeader, Section } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { countryByCode } from '@/lib/data/countries';
import { getAllCountries } from '@/server/providers/countries';

export const metadata: Metadata = {
  title: 'Tourism',
  description:
    'Curated world heritage destinations and region-by-region exploration of every country on Earth.',
};

// Backed entirely by the bundled country reference data and a hardcoded
// curated list, so this renders statically.
export const revalidate = 86_400;

const CONTINENT_ORDER: Continent[] = [
  'Africa',
  'Asia',
  'Europe',
  'North America',
  'South America',
  'Oceania',
  'Antarctica',
];

/**
 * Hand-picked, factual entries — deliberately not derived from any metric we
 * don't have. Each one is a real UNESCO World Heritage Site or globally
 * recognised destination; descriptions stick to established facts.
 */
const CURATED_DESTINATIONS: {
  name: string;
  countryCode: string;
  description: string;
}[] = [
  {
    name: 'Machu Picchu',
    countryCode: 'PE',
    description:
      '15th-century Inca citadel set high in the Andes above the Urubamba River valley. UNESCO World Heritage Site since 1983.',
  },
  {
    name: 'Serengeti National Park',
    countryCode: 'TZ',
    description:
      'Savanna ecosystem famous for the annual wildebeest migration, home to Africa\u2019s largest lion population. UNESCO World Heritage Site since 1981.',
  },
  {
    name: 'Great Barrier Reef',
    countryCode: 'AU',
    description:
      "The world's largest coral reef system, stretching over 2,300 km off Queensland. UNESCO World Heritage Site since 1981.",
  },
  {
    name: 'Angkor',
    countryCode: 'KH',
    description:
      'Khmer Empire capital complex including Angkor Wat, the largest religious monument ever constructed. UNESCO World Heritage Site since 1992.',
  },
  {
    name: 'Great Wall of China',
    countryCode: 'CN',
    description:
      'Fortification system built across northern China over more than two millennia to defend against invasions. UNESCO World Heritage Site since 1987.',
  },
  {
    name: 'Petra',
    countryCode: 'JO',
    description:
      'Nabataean city carved into rose-coloured sandstone cliffs, once a hub on ancient trade routes. UNESCO World Heritage Site since 1985.',
  },
  {
    name: 'Galápagos Islands',
    countryCode: 'EC',
    description:
      "Volcanic archipelago whose endemic species inspired Charles Darwin's theory of evolution. UNESCO World Heritage Site since 1978.",
  },
  {
    name: 'Yellowstone National Park',
    countryCode: 'US',
    description:
      "The world's first national park, known for the Old Faithful geyser and its geothermal features. UNESCO World Heritage Site since 1978.",
  },
];

export default async function TourismPage() {
  const countries = await getAllCountries();

  const byContinent = CONTINENT_ORDER.map((continent) => {
    const members = countries
      .filter((country) => country.continent === continent)
      .sort((a, b) => b.population - a.population)
      .slice(0, 6);
    return { continent, members, total: countries.filter((c) => c.continent === continent).length };
  }).filter((group) => group.members.length > 0);

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          <Badge variant="warning">
            <Compass className="size-3" aria-hidden />
            Visitor-flow analytics: roadmap
          </Badge>
        }
        title="Tourism"
        description="A curated look at globally recognised destinations, plus region-by-region exploration of every country. Visitor arrival and seasonality analytics are not wired up to live data yet, so no fabricated statistics appear here."
      />

      <Section
        title="Curated world destinations"
        description="A hand-picked set of well-known UNESCO World Heritage Sites and landmark destinations, one per region."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {CURATED_DESTINATIONS.map((destination) => {
            const country = countryByCode(destination.countryCode);
            return (
              <Card key={destination.name} className="h-full p-4">
                <div className="flex items-start gap-2">
                  <span className="text-xl leading-none" aria-hidden>
                    {country?.flagEmoji ?? '🌍'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{destination.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {country?.name ?? destination.countryCode}
                    </p>
                  </div>
                </div>
                <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                  {destination.description}
                </p>
              </Card>
            );
          })}
        </div>
      </Section>

      <Section
        title="Explore by region"
        description="Browse countries continent by continent — largest population first within each region."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {byContinent.map((group) => (
            <Card key={group.continent}>
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{group.continent}</p>
                  <span className="text-muted-foreground text-xs">{group.total} countries</span>
                </div>
                <ul className="divide-border/60 divide-y">
                  {group.members.map((country) => (
                    <li key={country.code}>
                      <Link
                        href={`/countries/${country.code.toLowerCase()}`}
                        className="group flex items-center gap-2.5 py-2 text-sm"
                      >
                        <span aria-hidden>{country.flagEmoji}</span>
                        <span className="min-w-0 flex-1 truncate">{country.name}</span>
                        <span className="text-muted-foreground truncate text-xs">
                          {country.capital ?? 'No capital'}
                        </span>
                        <ArrowUpRight
                          className="text-muted-foreground group-hover:text-primary size-3.5 shrink-0 transition-colors"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="text-muted-foreground mt-2 text-xs">
                  {formatCompact(group.members.reduce((sum, c) => sum + c.population, 0))} people
                  shown of {group.total} territories.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>
    </PageContainer>
  );
}
