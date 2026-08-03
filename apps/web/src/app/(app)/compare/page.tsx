import type { Metadata } from 'next';

import { CountryCompare } from '@/components/data/country-compare';
import { PageContainer, PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = {
  title: 'Compare',
  description: 'Side-by-side comparison of any two countries on Earth.',
};

// The comparison is entirely client-side against bundled reference data, so
// there is nothing to fetch on the server.
export const dynamic = 'force-static';

export default function ComparePage() {
  return (
    <PageContainer>
      <PageHeader
        title="Compare"
        description="Search for two countries to see population, geography, capital, currencies and languages side by side."
      />

      <CountryCompare />
    </PageContainer>
  );
}
