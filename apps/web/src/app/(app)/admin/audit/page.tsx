import { formatDateTime, type AuditLogEntry, type PaginatedResult } from '@edt/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AdminPagination } from '@/components/admin/admin-pagination';
import { RequireAuthNotice } from '@/components/data/require-auth-notice';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api/client';

export const metadata: Metadata = {
  title: 'Admin · Audit Log',
  description: 'Immutable record of privileged actions.',
};

// Reads admin-only, per-request audit data from the gateway.
export const dynamic = 'force-dynamic';

interface AuditSearchParams {
  page?: string;
}

async function loadAudit(
  searchParams: AuditSearchParams,
): Promise<
  { ok: true; result: PaginatedResult<AuditLogEntry> } | { ok: false; forbidden: boolean }
> {
  const page = Number.parseInt(searchParams.page ?? '1', 10) || 1;
  try {
    const result = await api<PaginatedResult<AuditLogEntry>>('/admin/audit', {
      query: { page, pageSize: 20 },
    });
    return { ok: true, result };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return { ok: false, forbidden: error.status === 403 };
    }
    return { ok: false, forbidden: false };
  }
}

export default function AdminAuditPage({ searchParams }: { searchParams: AuditSearchParams }) {
  return (
    <>
      <PageHeader
        eyebrow={<Badge variant="primary">Administration</Badge>}
        title="Audit Log"
        description="Immutable record of every privileged action taken on the platform."
      />

      <Suspense fallback={<AuditSkeleton />}>
        <AuditView searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function AuditView({ searchParams }: { searchParams: AuditSearchParams }) {
  const outcome = await loadAudit(searchParams);

  if (!outcome.ok) {
    return (
      <RequireAuthNotice
        title={outcome.forbidden ? 'Forbidden' : 'Sign in required'}
        description={
          outcome.forbidden
            ? 'Your account does not have permission to view the audit log.'
            : 'Sign in with an admin account to see the audit log.'
        }
      />
    );
  }

  const { result } = outcome;

  if (result.items.length === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="display-tight text-base">No audit entries yet</p>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
          Privileged actions will show up here as they happen.
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-border/60 border-b text-left text-xs">
                <th className="px-5 py-3 font-medium">Actor</th>
                <th className="px-3 py-3 font-medium">Action</th>
                <th className="px-3 py-3 font-medium">Resource</th>
                <th className="px-3 py-3 font-medium">Outcome</th>
                <th className="px-3 py-3 font-medium">IP</th>
                <th className="px-5 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-border/60 divide-y">
              {result.items.map((entry) => (
                <tr key={entry.id}>
                  <td className="text-muted-foreground truncate px-5 py-2.5">
                    {entry.actorEmail ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 font-medium">{entry.action}</td>
                  <td className="text-muted-foreground px-3 py-2.5">
                    {entry.resource}
                    {entry.resourceId ? ` · ${entry.resourceId.slice(0, 8)}` : ''}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={entry.outcome === 'success' ? 'success' : 'danger'}>
                      {entry.outcome}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground px-3 py-2.5">{entry.ip ?? '—'}</td>
                  <td className="text-muted-foreground px-5 py-2.5">
                    {formatDateTime(entry.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          Page {result.page} of {result.totalPages} · {result.total} entries
        </p>
        <AdminPagination
          page={result.page}
          hasNext={result.hasNext}
          hasPrevious={result.hasPrevious}
        />
      </div>
    </>
  );
}

function AuditSkeleton() {
  return (
    <Card className="p-5">
      <Skeleton className="h-5 w-40" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 10 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-full" />
        ))}
      </div>
    </Card>
  );
}
