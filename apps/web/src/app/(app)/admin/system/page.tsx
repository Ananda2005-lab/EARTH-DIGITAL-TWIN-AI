import type { HealthReport } from '@edt/shared';
import { Database, MemoryStick, Radio, ServerCog } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { MaintenanceToggle } from '@/components/admin/maintenance-toggle';
import { ClearCacheForm, ResetCircuitsButton } from '@/components/admin/system-controls';
import { StatCard, StatCardSkeleton } from '@/components/data/stat-card';
import { RequireAuthNotice } from '@/components/data/require-auth-notice';
import { PageHeader, Section } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api/client';

export const metadata: Metadata = {
  title: 'Admin · System',
  description: 'Database and Redis health, circuit breakers, memory and maintenance mode.',
};

// Owner-only, per-request system status from the gateway.
export const dynamic = 'force-dynamic';

type CircuitState = 'closed' | 'open' | 'half_open';

interface CircuitSnapshot {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  openedAt: number | null;
  lastFailureReason: string | null;
}

interface MaintenanceState {
  enabled: boolean;
  message: string | null;
  since: string | null;
}

interface SystemStatus extends HealthReport {
  maintenance: MaintenanceState;
  circuits: CircuitSnapshot[];
  postgis: boolean;
  memory: { rssMb: number; heapUsedMb: number };
  redisMemory: string | null;
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger'> = {
  ok: 'success',
  degraded: 'warning',
  down: 'danger',
};

const CIRCUIT_VARIANT: Record<CircuitState, 'success' | 'warning' | 'danger'> = {
  closed: 'success',
  half_open: 'warning',
  open: 'danger',
};

async function loadStatus(): Promise<
  { ok: true; status: SystemStatus } | { ok: false; forbidden: boolean }
> {
  try {
    const status = await api<SystemStatus>('/admin/system');
    return { ok: true, status };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return { ok: false, forbidden: error.status === 403 };
    }
    return { ok: false, forbidden: false };
  }
}

export default function AdminSystemPage() {
  return (
    <>
      <PageHeader
        eyebrow={<Badge variant="primary">Administration · Owner only</Badge>}
        title="System"
        description="Database and Redis health, upstream circuit breakers, memory and maintenance mode."
      />

      <Suspense fallback={<SystemSkeleton />}>
        <SystemView />
      </Suspense>
    </>
  );
}

async function SystemView() {
  const outcome = await loadStatus();

  if (!outcome.ok) {
    return (
      <RequireAuthNotice
        title={outcome.forbidden ? 'Forbidden' : 'Sign in required'}
        description={
          outcome.forbidden
            ? 'This page requires the owner role.'
            : 'Sign in with an owner account to see system status.'
        }
      />
    );
  }

  const { status } = outcome;

  return (
    <>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Overall status"
          value={status.status}
          icon={<ServerCog />}
          intent={
            status.status === 'ok'
              ? 'positive'
              : status.status === 'degraded'
                ? 'warning'
                : 'negative'
          }
          hint={`Uptime ${Math.round(status.uptimeSeconds / 60)} min`}
        />
        <StatCard
          label="Memory"
          value={`${status.memory.rssMb} MB`}
          unit="rss"
          icon={<MemoryStick />}
          hint={`${status.memory.heapUsedMb} MB heap used`}
        />
        <StatCard label="Redis memory" value={status.redisMemory ?? '—'} icon={<Radio />} />
        <StatCard
          label="PostGIS"
          value={status.postgis ? 'Available' : 'Unavailable'}
          icon={<Database />}
          intent={status.postgis ? 'positive' : 'warning'}
        />
      </div>

      <Section title="Maintenance" description="Toggle platform-wide maintenance mode.">
        <Card className="p-5">
          <MaintenanceToggle initial={status.maintenance} />
          {status.maintenance.message ? (
            <p className="text-muted-foreground mt-3 text-xs">{status.maintenance.message}</p>
          ) : null}
        </Card>
      </Section>

      <Section title="Health checks" description="Database, Redis and upstream provider probes.">
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-border/60 border-b text-left text-xs">
                  <th className="px-5 py-3 font-medium">Check</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 text-right font-medium">Latency</th>
                  <th className="px-5 py-3 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-border/60 divide-y">
                {status.checks.map((check) => (
                  <tr key={check.name}>
                    <td className="px-5 py-2.5 font-medium">{check.name}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant={STATUS_VARIANT[check.status] ?? 'neutral'}>
                        {check.status}
                      </Badge>
                    </td>
                    <td className="numeric px-3 py-2.5 text-right">
                      {check.latencyMs !== undefined ? `${check.latencyMs} ms` : '—'}
                    </td>
                    <td className="text-muted-foreground px-5 py-2.5">{check.detail ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </Section>

      <Section
        title="Upstream circuit breakers"
        description="Per-provider state. Open circuits skip the network until the reset window elapses."
      >
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-border/60 border-b text-left text-xs">
                  <th className="px-5 py-3 font-medium">Provider</th>
                  <th className="px-3 py-3 font-medium">State</th>
                  <th className="px-3 py-3 text-right font-medium">Failures</th>
                  <th className="px-3 py-3 text-right font-medium">Successes</th>
                  <th className="px-5 py-3 font-medium">Last failure</th>
                </tr>
              </thead>
              <tbody className="divide-border/60 divide-y">
                {status.circuits.map((circuit) => (
                  <tr key={circuit.name}>
                    <td className="px-5 py-2.5 font-medium">{circuit.name}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant={CIRCUIT_VARIANT[circuit.state]}>{circuit.state}</Badge>
                    </td>
                    <td className="numeric px-3 py-2.5 text-right">{circuit.failures}</td>
                    <td className="numeric px-3 py-2.5 text-right">{circuit.successes}</td>
                    <td className="text-muted-foreground px-5 py-2.5">
                      {circuit.lastFailureReason ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </Section>

      <Section
        title="Operations"
        description="Force a circuit reset or clear cached upstream payloads."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <ResetCircuitsButton />
          <ClearCacheForm />
        </div>
      </Section>
    </>
  );
}

function SystemSkeleton() {
  return (
    <>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
      <Card className="p-5">
        <Skeleton className="h-5 w-40" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
      </Card>
    </>
  );
}
