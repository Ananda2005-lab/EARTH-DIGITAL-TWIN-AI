import { formatDate, formatNumber, type PaginatedResult, type Report } from '@edt/shared';
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
  title: 'Admin · Reports',
  description: 'Every generated report with cost attribution.',
};

// Reads admin-only, per-request report data from the gateway.
export const dynamic = 'force-dynamic';

type AdminReport = Report & { userEmail: string };

interface ReportsSearchParams {
  page?: string;
  status?: string;
}

const STATUS_VARIANT: Record<string, 'neutral' | 'primary' | 'success' | 'danger'> = {
  queued: 'neutral',
  generating: 'primary',
  ready: 'success',
  failed: 'danger',
};

async function loadReports(
  searchParams: ReportsSearchParams,
): Promise<{ ok: true; result: PaginatedResult<AdminReport> } | { ok: false; forbidden: boolean }> {
  const page = Number.parseInt(searchParams.page ?? '1', 10) || 1;
  try {
    const result = await api<PaginatedResult<AdminReport>>('/admin/reports', {
      query: { page, pageSize: 20, status: searchParams.status },
    });
    return { ok: true, result };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return { ok: false, forbidden: error.status === 403 };
    }
    return { ok: false, forbidden: false };
  }
}

export default function AdminReportsPage({ searchParams }: { searchParams: ReportsSearchParams }) {
  return (
    <>
      <PageHeader
        eyebrow={<Badge variant="primary">Administration</Badge>}
        title="Reports"
        description="Every generated report with cost attribution."
      />

      <Suspense fallback={<ReportsSkeleton />}>
        <ReportsView searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ReportsView({ searchParams }: { searchParams: ReportsSearchParams }) {
  const outcome = await loadReports(searchParams);

  if (!outcome.ok) {
    return (
      <RequireAuthNotice
        title={outcome.forbidden ? 'Forbidden' : 'Sign in required'}
        description={
          outcome.forbidden
            ? 'Your account does not have permission to view reports.'
            : 'Sign in with an admin account to see generated reports.'
        }
      />
    );
  }

  const { result } = outcome;

  if (result.items.length === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="display-tight text-base">No reports found</p>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
          No reports match the current filter.
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
                <th className="px-5 py-3 font-medium">Title</th>
                <th className="px-3 py-3 font-medium">Kind</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">User</th>
                <th className="px-3 py-3 font-medium">Created</th>
                <th className="px-5 py-3 text-right font-medium">Tokens</th>
              </tr>
            </thead>
            <tbody className="divide-border/60 divide-y">
              {result.items.map((report) => (
                <tr key={report.id}>
                  <td className="max-w-[240px] truncate px-5 py-2.5 font-medium">{report.title}</td>
                  <td className="text-muted-foreground px-3 py-2.5">{report.kind}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={STATUS_VARIANT[report.status] ?? 'neutral'}>
                      {report.status}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground truncate px-3 py-2.5">{report.userEmail}</td>
                  <td className="text-muted-foreground px-3 py-2.5">
                    {formatDate(report.createdAt)}
                  </td>
                  <td className="numeric px-5 py-2.5 text-right">
                    {report.tokensUsed !== null ? formatNumber(report.tokensUsed) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          Page {result.page} of {result.totalPages} · {result.total} reports
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

function ReportsSkeleton() {
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
