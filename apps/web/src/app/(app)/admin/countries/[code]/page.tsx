import { formatArea, formatCompact } from '@edt/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageHeader, Section } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { countryByCode } from '@/lib/data/countries';

import { EditCountryForm } from './edit-country-form';

// Curation is an admin-only write action, so this route is never prerendered.
export const dynamic = 'force-dynamic';

export function generateMetadata({ params }: { params: { code: string } }): Metadata {
  const reference = countryByCode(params.code);
  if (!reference) return { title: 'Country not found' };
  return {
    title: `Admin · ${reference.name}`,
    description: `Curate the country record for ${reference.name}.`,
  };
}

export default function AdminCountryDetailPage({ params }: { params: { code: string } }) {
  const reference = countryByCode(params.code);
  if (!reference) notFound();

  return (
    <>
      <PageHeader
        eyebrow={<Badge variant="primary">{reference.continent}</Badge>}
        title={reference.name}
        description={`Curate the country record for ${reference.name}. Changes apply immediately to the live profile.`}
      />

      <Section
        title="Current record"
        description="Bundled reference data used as a starting point."
      >
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 pt-5 sm:grid-cols-4">
            <Fact label="Capital" value={reference.capital ?? 'None'} />
            <Fact label="Population" value={formatCompact(reference.population)} />
            <Fact label="Area" value={formatArea(reference.areaKm2)} />
            <Fact label="Code" value={reference.code} />
          </CardContent>
        </Card>
      </Section>

      <Section
        title="Edit"
        description="Fields left blank are cleared; population and area accept whole numbers."
      >
        <Card>
          <CardContent className="pt-5">
            <EditCountryForm
              code={reference.code}
              initialValues={{
                summary: '',
                capital: reference.capital ?? '',
                population: String(reference.population),
                areaKm2: String(reference.areaKm2),
                wikipediaUrl: '',
                coatOfArmsUrl: '',
                continent: reference.continent,
              }}
            />
          </CardContent>
        </Card>
      </Section>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="stat-label">{label}</dt>
      <dd className="numeric mt-0.5 text-sm">{value}</dd>
    </div>
  );
}
