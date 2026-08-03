import { formatDateTime, formatNumber, type PaginatedResult } from '@edt/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AdminPagination } from '@/components/admin/admin-pagination';
import { AiLogFlagButton } from '@/components/admin/ai-log-flag-button';
import { RequireAuthNotice } from '@/components/data/require-auth-notice';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api/client';

export const metadata: Metadata = {
  title: 'Admin · AI Logs',
  description: 'Prompt/response audit trail, tokens and moderation flags.',
};

// Reads admin-only, per-request AI usage data from the gateway.
export const dynamic = 'force-dynamic';

/**
 * Mirrors `AiLogEntry` from `apps/api/src/modules/admin/admin.service.ts`.
 * Not exported from `@edt/shared`, so the shape is duplicated here exactly.
 */
interface AiLogEntry {
  id: string;
  userId: string | null;
  userEmail: string | null;
  conversationId: string | null;
  model: string;
  intent: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  ok: boolean;
  errorCode: string | null;
  flagged: boolean;
  createdAt: string;
}

interface AiLogsSearchParams {
  page?: string;
  flaggedOnly?: string;
}

async function loadAiLogs(
  searchParams: AiLogsSearchParams,
): Promise<{ ok: true; result: PaginatedResult<AiLogEntry> } | { ok: false; forbidden: boolean }> {
  const page = Number.parseInt(searchParams.page ?? '1', 10) || 1;
  try {
    const result = await api<PaginatedResult<AiLogEntry>>('/admin/ai-logs', {
      query: {
        page,
        pageSize: 20,
        flaggedOnly: searchParams.flaggedOnly === 'true' ? true : undefined,
      },
    });
    return { ok: true, result };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return { ok: false, forbidden: error.status === 403 };
    }
    return { ok: false, forbidden: false };
  }
}

export default function AdminAiLogsPage({ searchParams }: { searchParams: AiLogsSearchParams }) {
  return (
    <>
      <PageHeader
        eyebrow={<Badge variant="primary">Administration</Badge>}
        title="AI Logs"
        description="Every AI interaction with token spend, latency and moderation flags."
      />

      <Suspense fallback={<AiLogsSkeleton />}>
        <AiLogsView searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function AiLogsView({ searchParams }: { searchParams: AiLogsSearchParams }) {
  const outcome = await loadAiLogs(searchParams);

  if (!outcome.ok) {
    return (
      <RequireAuthNotice
        title={outcome.forbidden ? 'Forbidden' : 'Sign in required'}
        description={
          outcome.forbidden
            ? 'Your account does not have permission to view AI logs.'
            : 'Sign in with an admin account to see AI logs.'
        }
      />
    );
  }

  const { result } = outcome;

  if (result.items.length === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="display-tight text-base">No AI interactions match this filter</p>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
          Try clearing the flagged-only filter.
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
                <th className="px-5 py-3 font-medium">User</th>
                <th className="px-3 py-3 font-medium">Model</th>
                <th className="px-3 py-3 font-medium">Intent</th>
                <th className="px-3 py-3 text-right font-medium">Tokens</th>
                <th className="px-3 py-3 text-right font-medium">Latency</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Flagged</th>
                <th className="px-3 py-3 font-medium">Created</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-border/60 divide-y">
              {result.items.map((entry) => (
                <tr key={entry.id}>
                  <td className="text-muted-foreground truncate px-5 py-2.5">
                    {entry.userEmail ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 font-medium">{entry.model}</td>
                  <td className="text-muted-foreground px-3 py-2.5">{entry.intent ?? '—'}</td>
                  <td className="numeric px-3 py-2.5 text-right">
                    {formatNumber(entry.totalTokens)}
                  </td>
                  <td className="numeric px-3 py-2.5 text-right">
                    {formatNumber(entry.latencyMs)} ms
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={entry.ok ? 'success' : 'danger'}>
                      {entry.ok ? 'Ok' : (entry.errorCode ?? 'Failed')}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    {entry.flagged ? <Badge variant="warning">Flagged</Badge> : null}
                  </td>
                  <td className="text-muted-foreground px-3 py-2.5">
                    {formatDateTime(entry.createdAt)}
                  </td>
                  <td className="px-5 py-2.5">
                    <AiLogFlagButton id={entry.id} flagged={entry.flagged} />
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

function AiLogsSkeleton() {
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
