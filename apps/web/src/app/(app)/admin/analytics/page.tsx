import { formatCompact, formatDateTime, formatNumber, type UsageMetric } from '@edt/shared';
import { Activity, Bot, Gauge, TriangleAlert, Users as UsersIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { StatCard, StatCardSkeleton } from '@/components/data/stat-card';
import { RequireAuthNotice } from '@/components/data/require-auth-notice';
import { PageHeader, Section } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api/client';

export const metadata: Metadata = {
  title: 'Admin · Analytics',
  description: 'Traffic, retention, latency and error budgets.',
};

// Reads admin-only, per-request usage data from the gateway.
export const dynamic = 'force-dynamic';

async function loadUsage(): Promise<
  { ok: true; usage: UsageMetric[] } | { ok: false; forbidden: boolean }
> {
  try {
    const usage = await api<UsageMetric[]>('/admin/analytics');
    return { ok: true, usage };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return { ok: false, forbidden: error.status === 403 };
    }
    return { ok: false, forbidden: false };
  }
}

export default function AdminAnalyticsPage() {
  return (
    <>
      <PageHeader
        eyebrow={<Badge variant="primary">Administration</Badge>}
        title="Analytics"
        description="Hourly traffic, error budget and AI token spend, fused from usage roll-ups."
      />

      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsView />
      </Suspense>
    </>
  );
}

async function AnalyticsView() {
  const outcome = await loadUsage();

  if (!outcome.ok) {
    return (
      <RequireAuthNotice
        title={outcome.forbidden ? 'Forbidden' : 'Sign in required'}
        description={
          outcome.forbidden
            ? 'Your account does not have permission to view analytics.'
            : 'Sign in with an admin account to see analytics.'
        }
      />
    );
  }

  const { usage } = outcome;

  if (usage.length === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="display-tight text-base">No usage data yet</p>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
          Hourly roll-ups have not accumulated for this platform yet.
        </p>
      </Card>
    );
  }

  const latest = usage[usage.length - 1]!;
  const chronological = [...usage].reverse();

  return (
    <>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Requests · latest hour"
          value={formatCompact(latest.requests)}
          icon={<Activity />}
          hint={formatDateTime(latest.bucket)}
        />
        <StatCard
          label="Errors · latest hour"
          value={formatCompact(latest.errors)}
          icon={<TriangleAlert />}
          intent={latest.errors > 0 ? 'warning' : 'positive'}
        />
        <StatCard
          label="p95 latency"
          value={formatNumber(latest.p95LatencyMs)}
          unit="ms"
          icon={<Gauge />}
        />
        <StatCard
          label="AI tokens · latest hour"
          value={formatCompact(latest.aiTokens)}
          icon={<Bot />}
        />
        <StatCard
          label="Unique users · latest hour"
          value={formatCompact(latest.uniqueUsers)}
          icon={<UsersIcon />}
        />
      </div>

      <Section
        title="Hourly roll-ups"
        description={`${formatNumber(usage.length)} buckets, oldest first.`}
      >
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-border/60 border-b text-left text-xs">
                  <th className="px-5 py-3 font-medium">Bucket</th>
                  <th className="px-3 py-3 text-right font-medium">Requests</th>
                  <th className="px-3 py-3 text-right font-medium">Errors</th>
                  <th className="px-3 py-3 text-right font-medium">p95</th>
                  <th className="px-3 py-3 text-right font-medium">AI tokens</th>
                  <th className="px-5 py-3 text-right font-medium">Unique users</th>
                </tr>
              </thead>
              <tbody className="divide-border/60 divide-y">
                {chronological.map((bucket) => (
                  <tr key={bucket.bucket}>
                    <td className="text-muted-foreground px-5 py-2.5">
                      {formatDateTime(bucket.bucket)}
                    </td>
                    <td className="numeric px-3 py-2.5 text-right">
                      {formatNumber(bucket.requests)}
                    </td>
                    <td className="numeric px-3 py-2.5 text-right">
                      {formatNumber(bucket.errors)}
                    </td>
                    <td className="numeric px-3 py-2.5 text-right">
                      {formatNumber(bucket.p95LatencyMs)} ms
                    </td>
                    <td className="numeric px-3 py-2.5 text-right">
                      {formatCompact(bucket.aiTokens)}
                    </td>
                    <td className="numeric px-5 py-2.5 text-right">
                      {formatNumber(bucket.uniqueUsers)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </Section>
    </>
  );
}

function AnalyticsSkeleton() {
  return (
    <>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
      <Card className="p-5">
        <Skeleton className="h-5 w-40" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 10 }, (_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
      </Card>
    </>
  );
}
