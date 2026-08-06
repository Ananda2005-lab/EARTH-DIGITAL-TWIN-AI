import type { Metadata } from 'next';

import { CitySearch } from '@/components/cities/city-search';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { getGazetteerCities } from '@/server/providers/cities';

export const metadata: Metadata = {
  title: 'Cities',
  description: 'The live urban gazetteer — capital cities with real population data.',
};

// Backed by the gazetteer API through the /api proxy, cached for a day.
export const revalidate = 86_400;

export default async function CitiesPage() {
  const cities = await getGazetteerCities();

  return (
    <PageContainer>
      <PageHeader
        eyebrow={<Badge variant="primary">{cities.length} cities</Badge>}
        title="Cities"
        description="The live gazetteer of capital cities, ordered by population. Search resolves against the gazetteer API."
      />

      <CitySearch cities={cities} />
    </PageContainer>
  );
}
