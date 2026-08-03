import type { Metadata } from 'next';

import { BroadcastForm } from '@/components/admin/broadcast-form';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = {
  title: 'Admin · Broadcasts',
  description: 'Compose and schedule platform-wide notices.',
};

// Purely a compose form — no history endpoint exists to read — but the auth
// gate is still enforced server-side by the gateway when the form submits.
export const dynamic = 'force-dynamic';

export default function AdminNotificationsPage() {
  return (
    <>
      <PageHeader
        eyebrow={<Badge variant="primary">Administration</Badge>}
        title="Broadcasts"
        description="Compose a platform-wide notice. Broadcasts are fire-and-forget — there is no history to browse here."
      />

      <BroadcastForm />
    </>
  );
}
