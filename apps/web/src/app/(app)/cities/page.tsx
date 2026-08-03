import type { Metadata } from 'next';

import { CitySearch } from '@/components/cities/city-search';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { getMajorCities } from '@/server/providers/cities';

export const metadata: Metadata = {
  title: 'Cities',
  description:
    'Urban intelligence starting with the world\u2019s major cities, while the full 40,000-city gazetteer comes online.',
};

// Backed entirely by the bundled curated dataset, so this renders statically.
export const revalidate = 86_400;

export default async function CitiesPage() {
  const cities = await getMajorCities();

  return (
    <PageContainer>
      <PageHeader
        eyebrow={<Badge variant="primary">{cities.length} cities</Badge>}
        title="Cities"
        description="A curated set of major world cities, ordered by population. The full gazetteer of 40,000 cities is coming soon."
      />

      <CitySearch cities={cities} />
    </PageContainer>
  );
}
