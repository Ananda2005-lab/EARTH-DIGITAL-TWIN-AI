import { Building2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Admin · Cities',
  description: 'Curate city gazetteer entries and metadata.',
};

export const dynamic = 'force-dynamic';

export default function AdminCitiesPage() {
  return (
    <>
      <PageHeader
        eyebrow={<Badge variant="primary">Administration</Badge>}
        title="Cities"
        description="Curate city gazetteer entries and metadata."
      />

      <Card className="p-10 text-center">
        <span className="bg-primary/12 text-primary mx-auto inline-flex size-12 items-center justify-center rounded-2xl">
          <Building2 className="size-6" aria-hidden />
        </span>
        <h2 className="display-tight mt-5 text-lg">City curation is pending</h2>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
          The gateway does not yet expose a live city gazetteer list endpoint, so there is nothing
          to curate here yet. Once that endpoint ships, this page will list city records the same
          way the countries curation screen does.
        </p>
        <div className="mt-6 flex justify-center">
          <Button variant="outline" asChild>
            <Link href="/admin">Back to overview</Link>
          </Button>
        </div>
      </Card>
    </>
  );
}
