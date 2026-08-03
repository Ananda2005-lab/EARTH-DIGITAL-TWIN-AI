import type { FeatureFlag } from '@edt/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { RequireAuthNotice } from '@/components/data/require-auth-notice';
import { FeatureFlagManager } from '@/components/admin/feature-flag-manager';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api/client';

export const metadata: Metadata = {
  title: 'Admin · Feature Flags',
  description: 'Progressive rollout controls per audience.',
};

// Reads admin-only, per-request flag data from the gateway.
export const dynamic = 'force-dynamic';

async function loadFlags(): Promise<
  { ok: true; flags: FeatureFlag[] } | { ok: false; forbidden: boolean }
> {
  try {
    const flags = await api<FeatureFlag[]>('/admin/feature-flags');
    return { ok: true, flags };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return { ok: false, forbidden: error.status === 403 };
    }
    return { ok: false, forbidden: false };
  }
}

export default function AdminFeatureFlagsPage() {
  return (
    <>
      <PageHeader
        eyebrow={<Badge variant="primary">Administration</Badge>}
        title="Feature Flags"
        description="Progressive rollout controls per audience."
      />

      <Suspense fallback={<FeatureFlagsSkeleton />}>
        <FeatureFlagsView />
      </Suspense>
    </>
  );
}

async function FeatureFlagsView() {
  const outcome = await loadFlags();

  if (!outcome.ok) {
    return (
      <RequireAuthNotice
        title={outcome.forbidden ? 'Forbidden' : 'Sign in required'}
        description={
          outcome.forbidden
            ? 'Your account does not have permission to view feature flags.'
            : 'Sign in with an admin account to see feature flags.'
        }
      />
    );
  }

  return <FeatureFlagManager flags={outcome.flags} />;
}

function FeatureFlagsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <Card key={index} className="p-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-3 w-40" />
          <Skeleton className="mt-4 h-8 w-full" />
        </Card>
      ))}
    </div>
  );
}
