import {
  countryCodeToFlagEmoji,
  formatCompact,
  type PaginatedResult,
  type CitySummary,
} from '@edt/shared';
import { Building2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminSearchBar } from '@/components/admin/admin-search-bar';
import { CityCurationDialog } from '@/components/admin/city-curation-dialog';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api/client';

export const metadata: Metadata = {
  title: 'Admin · Cities',
  description: 'City gazetteer records and populations.',
};

export const dynamic = 'force-dynamic';

interface CitiesSearchParams {
  page?: string;
  q?: string;
}

// DB-compatible slug, matching the seed's `slugify(asciiName)` per country.
function nameSlug(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 72) || 'place'
  );
}

function webId(city: CitySummary): string {
  return `${nameSlug(city.asciiName || city.name)}-${city.countryCode.toLowerCase()}`;
}

async function loadCities(
  searchParams: CitiesSearchParams,
): Promise<{ ok: true; result: PaginatedResult<CitySummary> } | { ok: false }> {
  const page = Number.parseInt(searchParams.page ?? '1', 10) || 1;
  try {
    const result = await api<PaginatedResult<CitySummary>>('/cities', {
      query: {
        page,
        pageSize: 25,
        q: searchParams.q,
        sortBy: 'population',
        sortDir: 'desc',
      },
    });
    return { ok: true, result };
  } catch {
    return { ok: false };
  }
}

export default function AdminCitiesPage({ searchParams }: { searchParams: CitiesSearchParams }) {
  return (
    <>
      <PageHeader
        eyebrow={<Badge variant="primary">Administration</Badge>}
        title="Cities"
        description="City gazetteer records and populations."
        actions={<AdminSearchBar placeholder="Search cities…" />}
      />

      <Suspense fallback={<CitiesSkeleton />}>
        <CitiesView searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CitiesView({ searchParams }: { searchParams: CitiesSearchParams }) {
  const outcome = await loadCities(searchParams);

  if (!outcome.ok) {
    return (
      <Card className="p-10 text-center">
        <span className="bg-primary/12 text-primary mx-auto inline-flex size-12 items-center justify-center rounded-2xl">
          <Building2 className="size-6" aria-hidden />
        </span>
        <h2 className="display-tight mt-5 text-lg">Could not load the gazetteer</h2>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
          The gateway is unreachable right now. Try again shortly.
        </p>
      </Card>
    );
  }

  const { result } = outcome;

  if (result.items.length === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="display-tight text-base">No cities match this search</p>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
          Try a different search term or clear the search box.
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-border/60 border-b text-left text-xs">
                <th className="px-5 py-3 font-medium">Flag</th>
                <th className="px-3 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Country</th>
                <th className="px-3 py-3 font-medium">Code</th>
                <th className="px-3 py-3 font-medium">Capital</th>
                <th className="px-3 py-3 font-medium">Timezone</th>
                <th className="px-5 py-3 text-right font-medium">Population</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-border/60 divide-y">
              {result.items.map((city) => (
                <tr key={city.id}>
                  <td className="px-5 py-2.5 text-lg leading-none" aria-hidden>
                    {countryCodeToFlagEmoji(city.countryCode)}
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/cities/${webId(city)}`}
                      className="focus-visible:ring-ring hover:text-primary font-medium transition-colors rounded outline-none focus-visible:ring-2"
                    >
                      {city.name}
                    </Link>
                  </td>
                  <td className="text-muted-foreground px-3 py-2.5">{city.countryName}</td>
                  <td className="numeric text-muted-foreground px-3 py-2.5">{city.countryCode}</td>
                  <td className="px-3 py-2.5">
                    {city.isCapital ? (
                      <Badge variant="primary">Capital</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="numeric text-muted-foreground px-3 py-2.5">{city.timezone}</td>
                  <td className="numeric px-5 py-2.5 text-right">
                    {formatCompact(city.population)}
                  </td>
                  <td className="px-5 py-2.5">
                    <CityCurationDialog cityId={city.id} name={city.name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="mt-4">
        <AdminPagination
          page={result.page}
          hasNext={result.hasNext}
          hasPrevious={result.hasPrevious}
        />
      </div>
    </>
  );
}

function CitiesSkeleton() {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="space-y-3 p-5">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
