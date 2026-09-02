import type { Metadata } from 'next';

import { CitySearch } from '@/components/cities/city-search';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { getMajorCities } from '@/server/providers/cities';

export const metadata: Metadata = {
  title: 'Cities',
  description:
    'Urban intelligence for major cities worldwide with live data on population, geography, climate and economy.',
};

// Reads live from the backend API, so this renders per request.
export const dynamic = 'force-dynamic';

export default async function CitiesPage() {
  const cities = await getMajorCities(500); // Fetch up to 500 major cities

  return (
    <PageContainer>
      <PageHeader
        eyebrow={<Badge variant="primary">{cities.length} cities</Badge>}
        title="Cities"
        description="The world's major urban centers, ordered by population. Search by name or country code. The vendored gazetteer grows with every sync — run `scripts/build-city-index.mjs` to pull the full Wikidata set."
      />

      <CitySearch cities={cities} />
    </PageContainer>
  );
}
