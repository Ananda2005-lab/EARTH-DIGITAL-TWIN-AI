import type { ReportKind, ReportStatus } from '@edt/shared';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STATUS_VARIANT: Record<ReportStatus, 'neutral' | 'primary' | 'success' | 'danger'> = {
  queued: 'neutral',
  generating: 'primary',
  ready: 'success',
  failed: 'danger',
};

const STATUS_LABEL: Record<ReportStatus, string> = {
  queued: 'Queued',
  generating: 'Generating',
  ready: 'Ready',
  failed: 'Failed',
};

export const REPORT_KIND_LABEL: Record<ReportKind, string> = {
  country_profile: 'Country profile',
  city_profile: 'City profile',
  area_summary: 'Area summary',
  environmental_risk: 'Environmental risk',
  climate_outlook: 'Climate outlook',
  comparison: 'Comparison',
  travel_plan: 'Travel plan',
  custom: 'Custom',
};

/** Status chip with a pulsing dot while a report is actively being written. */
export function ReportStatusBadge({
  status,
  className,
}: {
  status: ReportStatus;
  className?: string;
}) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={cn(className)}>
      {status === 'generating' ? <span className="live-dot" aria-hidden /> : null}
      {STATUS_LABEL[status]}
    </Badge>
  );
}
