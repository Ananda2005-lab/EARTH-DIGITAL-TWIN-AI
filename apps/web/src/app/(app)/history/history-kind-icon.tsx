import type { HistoryEntry } from '@edt/shared';
import { Bot, FileText, Layers, MapPin, Search, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

const KIND_ICON: Record<HistoryEntry['kind'], LucideIcon> = {
  search: Search,
  place: MapPin,
  report: FileText,
  ai: Bot,
  layer: Layers,
};

export const KIND_LABEL: Record<HistoryEntry['kind'], string> = {
  search: 'Search',
  place: 'Place',
  report: 'Report',
  ai: 'Assistant',
  layer: 'Layer',
};

export function HistoryKindIcon({
  kind,
  className,
}: {
  kind: HistoryEntry['kind'];
  className?: string;
}) {
  const Icon = KIND_ICON[kind];
  return <Icon className={cn('size-4', className)} aria-hidden />;
}
