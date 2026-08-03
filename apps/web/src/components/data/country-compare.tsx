'use client';

import { formatArea, formatCompact, formatNumber } from '@edt/shared';
import { ArrowLeftRight, Search } from 'lucide-react';
import * as React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { countryByCode, findCountries, type CountryReference } from '@/lib/data/countries';
import { cn } from '@/lib/utils';

/**
 * Fully client-rendered against the bundled country reference data (via
 * `findCountries`/`countryByCode`) — no server round-trip for the comparison
 * itself, matching the "no extra network calls" contract of the reference
 * dataset.
 */
export function CountryCompare() {
  const [codeA, setCodeA] = React.useState('IN');
  const [codeB, setCodeB] = React.useState('BR');

  const countryA = countryByCode(codeA) ?? null;
  const countryB = countryByCode(codeB) ?? null;

  const rows: { label: string; a: React.ReactNode; b: React.ReactNode }[] = [
    { label: 'Continent', a: countryA?.continent ?? '—', b: countryB?.continent ?? '—' },
    { label: 'Subregion', a: countryA?.subregion ?? '—', b: countryB?.subregion ?? '—' },
    { label: 'Capital', a: countryA?.capital ?? '—', b: countryB?.capital ?? '—' },
    {
      label: 'Population',
      a: countryA ? formatCompact(countryA.population) : '—',
      b: countryB ? formatCompact(countryB.population) : '—',
    },
    {
      label: 'Area',
      a: countryA ? formatArea(countryA.areaKm2) : '—',
      b: countryB ? formatArea(countryB.areaKm2) : '—',
    },
    {
      label: 'Population density',
      a: countryA ? `${formatNumber(countryA.population / countryA.areaKm2, 1)} /km²` : '—',
      b: countryB ? `${formatNumber(countryB.population / countryB.areaKm2, 1)} /km²` : '—',
    },
    {
      label: 'Currencies',
      a: countryA ? formatCurrencies(countryA) : '—',
      b: countryB ? formatCurrencies(countryB) : '—',
    },
    {
      label: 'Languages',
      a: countryA ? formatLanguages(countryA) : '—',
      b: countryB ? formatLanguages(countryB) : '—',
    },
  ];

  return (
    <div>
      <Card className="mb-6 p-4">
        <div className="grid items-start gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <CountryPicker label="Country A" value={countryA} onSelect={(c) => setCodeA(c.code)} />
          <span className="text-muted-foreground mx-auto mt-9 hidden sm:block" aria-hidden>
            <ArrowLeftRight className="size-4" />
          </span>
          <CountryPicker label="Country B" value={countryB} onSelect={(c) => setCodeB(c.code)} />
        </div>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>
            {countryA?.flagEmoji ?? ''} {countryA?.name ?? 'Country A'} vs{' '}
            {countryB?.flagEmoji ?? ''} {countryB?.name ?? 'Country B'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <dl className="divide-border/60 divide-y">
            {rows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-3 sm:px-6"
              >
                <dd className="truncate text-right text-sm">{row.a}</dd>
                <dt className="stat-label text-center">{row.label}</dt>
                <dd className="truncate text-left text-sm">{row.b}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function formatCurrencies(country: CountryReference): string {
  if (country.currencies.length === 0) return '—';
  return country.currencies.map((currency) => `${currency.name} (${currency.code})`).join(', ');
}

function formatLanguages(country: CountryReference): string {
  if (country.languages.length === 0) return '—';
  return country.languages.map((language) => language.name).join(', ');
}

/** Search box with a dropdown of fuzzy matches, backed by the bundled gazetteer. */
function CountryPicker({
  label,
  value,
  onSelect,
}: {
  label: string;
  value: CountryReference | null;
  onSelect: (country: CountryReference) => void;
}) {
  const id = React.useId();
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const results = React.useMemo(() => (query.trim() ? findCountries(query, 8) : []), [query]);

  React.useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={id} className="stat-label mb-1.5 block">
        {label}
      </label>
      <Input
        id={id}
        leading={<Search />}
        value={open ? query : (value?.name ?? '')}
        placeholder="Search countries…"
        onFocus={() => {
          setQuery('');
          setOpen(true);
        }}
        onChange={(event) => setQuery(event.target.value)}
      />
      {open && results.length > 0 ? (
        <div className="glass glass-highlight absolute z-10 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl p-1.5 shadow-lg">
          {results.map((country) => (
            <button
              key={country.code}
              type="button"
              onClick={() => {
                onSelect(country);
                setQuery('');
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                'hover:bg-surface-muted',
              )}
            >
              <span aria-hidden>{country.flagEmoji}</span>
              <span className="min-w-0 flex-1 truncate">{country.name}</span>
              <span className="text-muted-foreground text-xs">{country.code}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
