import { formatCompact, formatNumber, type SubscriptionPlan } from '@edt/shared';
import { Bot, FileText, ShieldCheck, TriangleAlert, Users } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { RequireAuthNotice } from '@/components/data/require-auth-notice';
import { StatCard, StatCardSkeleton } from '@/components/data/stat-card';
import { PageHeader, Section } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api/client';

export const metadata: Metadata = {
  title: 'Admin Overview',
  description: 'Platform KPIs and live system health.',
};

// Reads admin-only, per-request KPIs from the gateway.
export const dynamic = 'force-dynamic';

/**
 * Mirrors `AdminDashboard` from `apps/api/src/modules/admin/admin.service.ts`.
 * Not exported from `@edt/shared`, so the response shape is declared here to
 * match the gateway contract exactly.
 */
interface AdminDashboard {
  users: {
    total: number;
    active: number;
    suspended: number;
    unverified: number;
    newLast7Days: number;
  };
  plans: { plan: SubscriptionPlan; count: number }[];
  content: { reports: number; workspaces: number; bookmarks: number; conversations: number };
  ai: { requests24h: number; tokens24h: number; failures24h: number; flagged: number };
  hazards: { cached: number; notified: number };
}

async function loadOverview(): Promise<
  { ok: true; dashboard: AdminDashboard } | { ok: false; forbidden: boolean }
> {
  try {
    const dashboard = await api<AdminDashboard>('/admin/overview');
    return { ok: true, dashboard };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return { ok: false, forbidden: error.status === 403 };
    }
    return { ok: false, forbidden: false };
  }
}

export default function AdminOverviewPage() {
  return (
    <>
      <PageHeader
        eyebrow={<Badge variant="primary">Administration</Badge>}
        title="Overview"
        description="Platform KPIs and live system health."
      />

      <Suspense fallback={<OverviewSkeleton />}>
        <OverviewView />
      </Suspense>
    </>
  );
}

async function OverviewView() {
  const result = await loadOverview();

  if (!result.ok) {
    return (
      <RequireAuthNotice
        title={result.forbidden ? 'Forbidden' : 'Sign in required'}
        description={
          result.forbidden
            ? 'Your account does not have permission to view admin data.'
            : 'Sign in with an admin account to see platform KPIs.'
        }
      />
    );
  }

  const { dashboard } = result;

  return (
    <>
      <Section title="Users" description="Accounts across every plan and status.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total users"
            value={formatCompact(dashboard.users.total)}
            icon={<Users />}
          />
          <StatCard
            label="Active"
            value={formatCompact(dashboard.users.active)}
            intent="positive"
          />
          <StatCard
            label="Suspended"
            value={formatCompact(dashboard.users.suspended)}
            intent={dashboard.users.suspended > 0 ? 'warning' : 'neutral'}
          />
          <StatCard
            label="New · 7 days"
            value={formatCompact(dashboard.users.newLast7Days)}
            intent="positive"
          />
        </div>
      </Section>

      <Section title="Content" description="Everything users have created.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Reports"
            value={formatCompact(dashboard.content.reports)}
            icon={<FileText />}
          />
          <StatCard label="Workspaces" value={formatCompact(dashboard.content.workspaces)} />
          <StatCard label="Bookmarks" value={formatCompact(dashboard.content.bookmarks)} />
          <StatCard label="Conversations" value={formatCompact(dashboard.content.conversations)} />
        </div>
      </Section>

      <Section title="AI usage" description="Last 24 hours across every model call.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Requests · 24h"
            value={formatCompact(dashboard.ai.requests24h)}
            icon={<Bot />}
          />
          <StatCard label="Tokens · 24h" value={formatCompact(dashboard.ai.tokens24h)} />
          <StatCard
            label="Failures · 24h"
            value={formatCompact(dashboard.ai.failures24h)}
            intent={dashboard.ai.failures24h > 0 ? 'negative' : 'positive'}
          />
          <StatCard
            label="Flagged"
            value={formatCompact(dashboard.ai.flagged)}
            intent={dashboard.ai.flagged > 0 ? 'warning' : 'neutral'}
          />
        </div>
      </Section>

      <Section title="Hazards" description="Hazard event cache health.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Cached events"
            value={formatCompact(dashboard.hazards.cached)}
            icon={<TriangleAlert />}
          />
          <StatCard label="Notified" value={formatCompact(dashboard.hazards.notified)} />
        </div>
      </Section>

      <Section title="Plans" description="User distribution across subscription tiers.">
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-border/60 border-b text-left text-xs">
                  <th className="px-5 py-3 font-medium">Plan</th>
                  <th className="px-5 py-3 text-right font-medium">Users</th>
                </tr>
              </thead>
              <tbody className="divide-border/60 divide-y">
                {dashboard.plans.map((row) => (
                  <tr key={row.plan}>
                    <td className="px-5 py-2.5">
                      <span className="inline-flex items-center gap-2">
                        <ShieldCheck className="text-muted-foreground size-3.5" aria-hidden />
                        <span className="capitalize">{row.plan}</span>
                      </span>
                    </td>
                    <td className="numeric px-5 py-2.5 text-right">{formatNumber(row.count)}</td>
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

function OverviewSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }, (_, sectionIndex) => (
        <div key={sectionIndex} className="mb-8">
          <Skeleton className="mb-3 h-5 w-32" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <StatCardSkeleton key={index} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
