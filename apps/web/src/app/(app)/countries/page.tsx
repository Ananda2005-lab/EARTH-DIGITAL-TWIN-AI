import { formatArea, formatCompact, type Continent, type CountrySummary } from '@edt/shared';
import { ArrowUpRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { getAllCountries } from '@/server/providers/countries';

export const metadata: Metadata = {
  title: 'Countries',
  description:
    'Deep profiles for every territory on Earth: population, economy, geography and live conditions.',
};

// The gazetteer is bundled reference data, so this page can be fully static.
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

export default async function CountriesPage() {
  const countries = await getAllCountries();

  const byContinent = CONTINENT_ORDER.map((continent) => ({
    continent,
    countries: countries
      .filter((country) => country.continent === continent)
      .sort((a, b) => b.population - a.population),
  })).filter((group) => group.countries.length > 0);

  const totalPopulation = countries.reduce((sum, country) => sum + country.population, 0);

  return (
    <PageContainer>
      <PageHeader
        eyebrow={<Badge variant="primary">{countries.length} territories</Badge>}
        title="Countries"
        description={`Every sovereign state and dependent territory, ordered by population within each continent. ${formatCompact(totalPopulation)} people in total.`}
      />

      {byContinent.map((group) => (
        <section key={group.continent} className="mb-10">
          <div className="mb-3 flex items-center gap-3">
            <h3 className="display-tight text-base sm:text-lg">{group.continent}</h3>
            <span className="bg-border/70 h-px flex-1" aria-hidden />
            <span className="text-muted-foreground text-xs">{group.countries.length}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {group.countries.map((country) => (
              <CountryTile key={country.code} country={country} />
            ))}
          </div>
        </section>
      ))}
    </PageContainer>
  );
}

function CountryTile({ country }: { country: CountrySummary }) {
  return (
    <Link
      href={`/countries/${country.code.toLowerCase()}`}
      className="focus-visible:ring-ring rounded-2xl outline-none focus-visible:ring-2"
    >
      <Card interactive className="group h-full p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none" aria-hidden>
            {country.flagEmoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{country.name}</p>
            <p className="text-muted-foreground truncate text-xs">
              {country.capital ?? 'No capital'}
            </p>
          </div>
          <ArrowUpRight
            className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-colors"
            aria-hidden
          />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="stat-label">Population</dt>
            <dd className="numeric mt-0.5 text-sm">{formatCompact(country.population)}</dd>
          </div>
          <div>
            <dt className="stat-label">Area</dt>
            <dd className="numeric mt-0.5 text-sm">{formatArea(country.areaKm2)}</dd>
          </div>
        </dl>
      </Card>
    </Link>
  );
}
