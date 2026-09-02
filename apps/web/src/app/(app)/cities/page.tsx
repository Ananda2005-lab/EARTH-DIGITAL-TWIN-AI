import type { Metadata } from 'next';

import { CitySearch } from '@/components/cities/city-search';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { getGazetteerCities } from '@/server/providers/cities';

export const metadata: Metadata = {
  title: 'Cities',
<<<<<<< HEAD
  description:
    'Urban intelligence for major cities worldwide with live data on population, geography, climate and economy.',
};

// Reads live from the backend API, so this renders per request.
export const dynamic = 'force-dynamic';

export default async function CitiesPage() {
  const cities = await getMajorCities(500); // Fetch up to 500 major cities
=======
  description: 'The live urban gazetteer — capital cities with real population data.',
};

// Backed by the gazetteer API through the /api proxy, cached for a day.
export const revalidate = 86_400;

export default async function CitiesPage() {
  const cities = await getGazetteerCities();
>>>>>>> 005c357b565eaf6ff99b0cc04ff8ed07cf1d64a0

  return (
    <PageContainer>
      <PageHeader
        eyebrow={<Badge variant="primary">{cities.length} cities</Badge>}
        title="Cities"
<<<<<<< HEAD
        description="The world's major urban centers, ordered by population. Search by name or country code. The vendored gazetteer grows with every sync — run `scripts/build-city-index.mjs` to pull the full Wikidata set."
=======
        description="The live gazetteer of capital cities, ordered by population. Search resolves against the gazetteer API."
>>>>>>> 005c357b565eaf6ff99b0cc04ff8ed07cf1d64a0
      />

      <CitySearch cities={cities} />
    </PageContainer>
  );
}
