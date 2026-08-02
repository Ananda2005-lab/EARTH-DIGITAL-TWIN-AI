import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import type * as React from 'react';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type Trend = 'up' | 'down' | 'flat';

/**
 * The atomic KPI tile used across Mission Control, analytics and admin.
 *
 * `intent` colours the accent independently of `trend`, because "up" is good for
 * visitors and bad for wildfire count — the caller decides which it is.
 */
export function StatCard({
  label,
  value,
  unit,
  hint,
  icon,
  trend,
  trendLabel,
  intent = 'neutral',
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: string;
  icon?: React.ReactNode;
  trend?: Trend;
  trendLabel?: string;
  intent?: 'neutral' | 'positive' | 'negative' | 'warning';
  className?: string;
}) {
  const intentClass = {
    neutral: 'text-primary',
    positive: 'text-success',
    negative: 'text-destructive',
    warning: 'text-warning',
  }[intent];

  return (
    <Card className={cn('overflow-hidden p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="stat-label">{label}</span>
        {icon ? <span className={cn('shrink-0 [&_svg]:size-4', intentClass)}>{icon}</span> : null}
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="stat-value">{value}</span>
        {unit ? <span className="text-muted-foreground text-xs font-medium">{unit}</span> : null}
      </div>

      {trend || hint ? (
        <div className="mt-2 flex items-center gap-2 text-xs">
          {trend ? <TrendPill trend={trend} label={trendLabel} intent={intent} /> : null}
          {hint ? <span className="text-muted-foreground truncate">{hint}</span> : null}
        </div>
      ) : null}
    </Card>
  );
}

function TrendPill({
  trend,
  label,
  intent,
}: {
  trend: Trend;
  label?: string;
  intent: 'neutral' | 'positive' | 'negative' | 'warning';
}) {
  const Icon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : ArrowRight;
  const tone =
    intent === 'positive'
      ? 'text-success bg-success/10'
      : intent === 'negative'
        ? 'text-destructive bg-destructive/10'
        : intent === 'warning'
          ? 'text-warning bg-warning/10'
          : 'text-muted-foreground bg-surface-muted';

  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium', tone)}
    >
      <Icon className="size-3" aria-hidden />
      {label ?? trend}
    </span>
  );
}

/** Placeholder with the same footprint, so streaming in data never shifts layout. */
export function StatCardSkeleton() {
  return (
    <Card className="p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-7 w-20" />
      <Skeleton className="mt-3 h-3 w-32" />
    </Card>
  );
}
