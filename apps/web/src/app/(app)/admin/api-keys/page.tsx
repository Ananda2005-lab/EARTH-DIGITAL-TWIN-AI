import { formatDate, formatRelativeTime, type ApiKeyRecord } from '@edt/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { IssueApiKeyDialog } from '@/components/admin/issue-api-key-dialog';
import { RevokeApiKeyButton } from '@/components/admin/revoke-api-key-button';
import { RequireAuthNotice } from '@/components/data/require-auth-notice';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api/client';

export const metadata: Metadata = {
  title: 'Admin · API Keys',
  description: 'Issue, rotate and revoke API credentials.',
};

// Owner-only, per-request credential data from the gateway.
export const dynamic = 'force-dynamic';

async function loadKeys(): Promise<
  { ok: true; keys: ApiKeyRecord[] } | { ok: false; forbidden: boolean }
> {
  try {
    const keys = await api<ApiKeyRecord[]>('/admin/system/api-keys', {
      query: { includeRevoked: true },
    });
    return { ok: true, keys };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return { ok: false, forbidden: error.status === 403 };
    }
    return { ok: false, forbidden: false };
  }
}

export default function AdminApiKeysPage() {
  return (
    <>
      <PageHeader
        eyebrow={<Badge variant="primary">Administration · Owner only</Badge>}
        title="API Keys"
        description="Issue, rotate and revoke credentials used to call the gateway directly."
        actions={<IssueApiKeyDialog />}
      />

      <Suspense fallback={<ApiKeysSkeleton />}>
        <ApiKeysView />
      </Suspense>
    </>
  );
}

async function ApiKeysView() {
  const outcome = await loadKeys();

  if (!outcome.ok) {
    return (
      <RequireAuthNotice
        title={outcome.forbidden ? 'Forbidden' : 'Sign in required'}
        description={
          outcome.forbidden
            ? 'This page requires the owner role.'
            : 'Sign in with an owner account to see API keys.'
        }
      />
    );
  }

  const { keys } = outcome;

  if (keys.length === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="display-tight text-base">No API keys yet</p>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
          Issue one to let a service call the gateway directly.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-border/60 border-b text-left text-xs">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-3 py-3 font-medium">Key</th>
              <th className="px-3 py-3 font-medium">Scopes</th>
              <th className="px-3 py-3 text-right font-medium">Rate limit</th>
              <th className="px-3 py-3 font-medium">Last used</th>
              <th className="px-3 py-3 font-medium">Expires</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {keys.map((key) => (
              <tr key={key.id}>
                <td className="px-5 py-2.5 font-medium">{key.name}</td>
                <td className="text-muted-foreground px-3 py-2.5 font-mono text-xs">
                  ••••{key.suffix}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {key.scopes.map((scope) => (
                      <Badge key={scope} variant="neutral">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="numeric px-3 py-2.5 text-right">{key.rateLimitPerMinute}/min</td>
                <td className="text-muted-foreground px-3 py-2.5">
                  {key.lastUsedAt ? formatRelativeTime(key.lastUsedAt) : 'Never'}
                </td>
                <td className="text-muted-foreground px-3 py-2.5">
                  {key.expiresAt ? formatDate(key.expiresAt) : 'Never'}
                </td>
                <td className="px-3 py-2.5">
                  <Badge variant={key.revokedAt ? 'danger' : 'success'}>
                    {key.revokedAt ? 'Revoked' : 'Active'}
                  </Badge>
                </td>
                <td className="px-5 py-2.5">
                  {key.revokedAt ? null : <RevokeApiKeyButton id={key.id} name={key.name} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function ApiKeysSkeleton() {
  return (
    <Card className="p-5">
      <Skeleton className="h-5 w-40" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-full" />
        ))}
      </div>
    </Card>
  );
}
