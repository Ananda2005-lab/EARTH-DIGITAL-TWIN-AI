'use client';

import { countryCodeToFlagEmoji, formatCompact } from '@edt/shared';
import { ArrowUpRight, Search } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { fuzzyMatch } from '@/lib/utils';
import type { CityLite } from '@/server/providers/cities';

/**
 * Client-side filter over the curated city list. The dataset is tiny (~40
 * entries) so there is no debouncing or async lookup — every keystroke just
 * re-filters the array in memory.
 */
export function CitySearch({ cities }: { cities: CityLite[] }) {
  const [query, setQuery] = React.useState('');

  const filtered = React.useMemo(() => {
    if (query.trim().length === 0) return cities;
    return cities.filter(
      (city) => fuzzyMatch(city.name, query) || fuzzyMatch(city.countryCode, query),
    );
  }, [cities, query]);

  return (
    <div>
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        leading={<Search />}
        placeholder="Search cities or country codes…"
        aria-label="Search cities"
        className="mb-6 max-w-sm"
      />

      {filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="display-tight text-base">No cities match &ldquo;{query}&rdquo;</p>
          <p className="text-muted-foreground mt-2 text-sm">
            Try a different city name or a two-letter country code.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((city) => (
            <CityTile key={city.id} city={city} />
          ))}
        </div>
      )}
    </div>
  );
}

function CityTile({ city }: { city: CityLite }) {
  return (
    <Link
      href={`/cities/${city.id}`}
      className="focus-visible:ring-ring rounded-2xl outline-none focus-visible:ring-2"
    >
      <Card interactive className="group h-full p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none" aria-hidden>
            {countryCodeToFlagEmoji(city.countryCode)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{city.name}</p>
            <p className="text-muted-foreground truncate text-xs">{city.countryCode}</p>
          </div>
          <ArrowUpRight
            className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-colors"
            aria-hidden
          />
        </div>

        <dl className="mt-4 text-xs">
          <dt className="stat-label">Population</dt>
          <dd className="numeric mt-0.5 text-sm">{formatCompact(city.population)}</dd>
        </dl>
      </Card>
    </Link>
  );
}
