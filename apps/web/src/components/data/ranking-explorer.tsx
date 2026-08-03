'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import type { CountryLite } from '@/components/data/analytics-types';
import { formatIndicatorValue } from '@/components/data/indicator-format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { RankingRow } from '@/server/providers/countries';

export interface IndicatorMeta {
  id: string;
  label: string;
  unit: string;
  category: string;
  higherIsBetter: boolean;
  description: string;
}

/**
 * Everything server-rendered — switching indicator or direction is a plain
 * navigation to `?indicator=…&direction=…`, which the page component re-reads
 * via `searchParams` and refetches with. No client-side data fetching needed.
 */
export function RankingExplorer({
  countries,
  catalogue,
  indicator,
  direction,
  rows,
}: {
  countries: CountryLite[];
  catalogue: readonly IndicatorMeta[];
  indicator: IndicatorMeta;
  direction: 'asc' | 'desc';
  rows: RankingRow[];
}) {
  const [continentFilter, setContinentFilter] = React.useState<string | null>(null);

  const continents = React.useMemo(
    () => Array.from(new Set(countries.map((c) => c.continent))).sort(),
    [countries],
  );

  const visibleRows = continentFilter
    ? rows.filter((row) => row.continent === continentFilter)
    : rows;

  const grouped = React.useMemo(() => {
    const byCategory = new Map<string, IndicatorMeta[]>();
    for (const entry of catalogue) {
      const bucket = byCategory.get(entry.category) ?? [];
      bucket.push(entry);
      byCategory.set(entry.category, bucket);
    }
    return byCategory;
  }, [catalogue]);

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>{indicator.label}</CardTitle>
          <p className="text-muted-foreground mt-1 text-xs">{indicator.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="indicator-select">
            Indicator
          </label>
          <select
            id="indicator-select"
            defaultValue={indicator.id}
            onChange={(event) => {
              window.location.href = `/analytics?indicator=${encodeURIComponent(event.target.value)}&direction=${direction}`;
            }}
            className="bg-surface-muted/60 border-border focus-visible:border-primary/60 focus-visible:ring-ring/40 h-9 rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-2"
          >
            {[...grouped.entries()].map(([category, entries]) => (
              <optgroup key={category} label={category}>
                {entries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <Link
            href={`/analytics?indicator=${encodeURIComponent(indicator.id)}&direction=${direction === 'desc' ? 'asc' : 'desc'}`}
            className={cn(
              'border-border bg-surface-muted/60 hover:bg-surface-strong inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors',
            )}
          >
            {direction === 'desc' ? (
              <ArrowDown className="size-3.5" />
            ) : (
              <ArrowUp className="size-3.5" />
            )}
            {direction === 'desc' ? 'Highest first' : 'Lowest first'}
          </Link>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <FilterChip active={continentFilter === null} onClick={() => setContinentFilter(null)}>
            All continents
          </FilterChip>
          {continents.map((continent) => (
            <FilterChip
              key={continent}
              active={continentFilter === continent}
              onClick={() => setContinentFilter(continent)}
            >
              {continent}
            </FilterChip>
          ))}
        </div>

        {visibleRows.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No data available for this indicator{continentFilter ? ` in ${continentFilter}` : ''}.
          </p>
        ) : (
          <ul className="divide-border/60 divide-y">
            {visibleRows.map((row, index) => (
              <li key={row.code} className="flex items-center gap-3 py-2.5">
                <span className="stat-label numeric w-6 shrink-0 text-right">{index + 1}</span>
                <span className="shrink-0 text-lg leading-none" aria-hidden>
                  {row.flagEmoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.name}</p>
                  <p className="text-muted-foreground truncate text-xs">{row.continent}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="numeric text-sm font-medium">
                    {formatIndicatorValue(row.value, indicator.unit)}
                  </p>
                  <p className="text-muted-foreground text-xs">{row.year}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-primary/30 bg-primary/12 text-primary'
          : 'border-border bg-surface-muted text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
