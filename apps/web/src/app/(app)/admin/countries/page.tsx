import type { Metadata } from 'next';

import { AdminCountrySearch } from '@/components/admin/admin-country-search';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { COUNTRIES } from '@/lib/data/countries';

export const metadata: Metadata = {
  title: 'Admin · Countries',
  description: 'Curate country records and indicator overrides.',
};

// Not strictly live data (the list itself is bundled reference data), but the
// page sits under the admin surface alongside pages that are, so it stays
// consistent and is never prerendered.
export const dynamic = 'force-dynamic';

export default function AdminCountriesPage() {
  return (
    <>
      <PageHeader
        eyebrow={<Badge variant="primary">Administration</Badge>}
        title="Countries"
        description="Curate country records and indicator overrides."
      />

      <AdminCountrySearch countries={COUNTRIES} />
    </>
  );
}
