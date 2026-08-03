'use client';

import { formatCompact } from '@edt/shared';
import { ArrowUpRight, Search } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { CountryReference } from '@/lib/data/countries';
import { fuzzyMatch } from '@/lib/utils';

/**
 * Client-side filter over the bundled ~250-country reference list. The
 * dataset is small enough that there is no need for a debounce or an async
 * lookup — every keystroke just re-filters the array in memory.
 */
export function AdminCountrySearch({ countries }: { countries: CountryReference[] }) {
  const [query, setQuery] = React.useState('');

  const filtered = React.useMemo(() => {
    if (query.trim().length === 0) return countries;
    return countries.filter(
      (country) => fuzzyMatch(country.name, query) || fuzzyMatch(country.code, query),
    );
  }, [countries, query]);

  return (
    <div>
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        leading={<Search />}
        placeholder="Search countries or ISO codes…"
        aria-label="Search countries"
        className="mb-4 max-w-sm"
      />

      {filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="display-tight text-base">No countries match &ldquo;{query}&rdquo;</p>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-border/60 border-b text-left text-xs">
                  <th className="px-5 py-3 font-medium">Flag</th>
                  <th className="px-3 py-3 font-medium">Name</th>
                  <th className="px-3 py-3 font-medium">Code</th>
                  <th className="px-3 py-3 font-medium">Continent</th>
                  <th className="px-5 py-3 text-right font-medium">Population</th>
                </tr>
              </thead>
              <tbody className="divide-border/60 divide-y">
                {filtered.map((country) => (
                  <tr key={country.code}>
                    <td className="px-5 py-2.5 text-lg leading-none" aria-hidden>
                      {country.flagEmoji}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/admin/countries/${country.code.toLowerCase()}`}
                        className="focus-visible:ring-ring group inline-flex items-center gap-1.5 rounded outline-none focus-visible:ring-2"
                      >
                        <span className="font-medium">{country.name}</span>
                        <ArrowUpRight
                          className="text-muted-foreground group-hover:text-primary size-3.5 shrink-0 transition-colors"
                          aria-hidden
                        />
                      </Link>
                    </td>
                    <td className="numeric text-muted-foreground px-3 py-2.5">{country.code}</td>
                    <td className="text-muted-foreground px-3 py-2.5">{country.continent}</td>
                    <td className="numeric px-5 py-2.5 text-right">
                      {formatCompact(country.population)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
