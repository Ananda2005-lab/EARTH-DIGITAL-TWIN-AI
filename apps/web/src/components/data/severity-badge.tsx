import type { HazardKind, HazardSeverity } from '@edt/shared';
import {
  Activity,
  Flame,
  Mountain,
  MountainSnow,
  Sun,
  Tornado,
  Waves,
  type LucideIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const SEVERITY_VARIANT: Record<HazardSeverity, 'neutral' | 'primary' | 'warning' | 'danger'> = {
  info: 'neutral',
  low: 'primary',
  moderate: 'warning',
  high: 'danger',
  extreme: 'danger',
};

/** Shared severity chip so hazard colouring is identical everywhere it appears. */
export function SeverityBadge({
  severity,
  className,
}: {
  severity: HazardSeverity;
  className?: string;
}) {
  return (
    <Badge variant={SEVERITY_VARIANT[severity]} className={cn('uppercase', className)}>
      {severity}
    </Badge>
  );
}

const KIND_ICON: Record<HazardKind, LucideIcon> = {
  earthquake: Activity,
  wildfire: Flame,
  volcano: Mountain,
  flood: Waves,
  cyclone: Tornado,
  drought: Sun,
  landslide: MountainSnow,
  tsunami: Waves,
};

export function HazardKindIcon({ kind, className }: { kind: HazardKind; className?: string }) {
  const Icon = KIND_ICON[kind];
  return <Icon className={cn('size-4', className)} aria-hidden />;
}
