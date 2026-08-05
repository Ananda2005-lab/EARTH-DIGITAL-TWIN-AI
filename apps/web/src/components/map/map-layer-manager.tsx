'use client';

import {
  BASEMAPS,
  LAYERS,
  LAYER_CATEGORY_LABEL,
  LAYER_CATEGORY_ORDER,
  type BasemapDefinition,
} from '@edt/shared';
import { ChevronRight, Layers, Lock, SlidersHorizontal } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

import { SUPPORTED_DATA_LAYERS } from './map-data';

export function MapLayerManager({
  basemap,
  onBasemapChange,
  enabled,
  onToggleLayer,
  counts,
}: {
  basemap: string;
  onBasemapChange: (id: string) => void;
  enabled: ReadonlySet<string>;
  onToggleLayer: (id: string, value: boolean) => void;
  counts: Record<string, number>;
}) {
  const [open, setOpen] = React.useState(true);
  const active = BASEMAPS.find((entry) => entry.id === basemap);

  return (
    <div className="z-overlay absolute right-4 top-4 flex max-h-[calc(100dvh-3rem)] w-72 flex-col gap-2">
      <Button
        variant="glass"
        size="sm"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="justify-between self-end"
      >
        <span className="flex items-center gap-2">
          <Layers className="size-4" />
          Layers
        </span>
        <ChevronRight className={cn('size-4 transition-transform', open && 'rotate-90')} />
      </Button>

      {open ? (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-3">
              <BasemapPicker active={basemap} onSelect={onBasemapChange} />
              <div className="mt-4 flex items-center justify-between px-1">
                <p className="display-tight flex items-center gap-1.5 text-sm">
                  <SlidersHorizontal className="text-muted-foreground size-3.5" />
                  Data layers
                </p>
                {active ? (
                  <span className="text-muted-foreground text-[10px]">{active.label}</span>
                ) : null}
              </div>
              <div className="mt-2 space-y-4">
                {LAYER_CATEGORY_ORDER.filter(
                  (category) =>
                    LAYERS.some((layer) => layer.category === category) && category !== 'base',
                ).map((category) => (
                  <LayerGroup
                    key={category}
                    label={LAYER_CATEGORY_LABEL[category]}
                    layers={LAYERS.filter((layer) => layer.category === category)}
                    enabled={enabled}
                    counts={counts}
                    onToggle={onToggleLayer}
                  />
                ))}
              </div>
            </div>
          </ScrollArea>
        </Card>
      ) : null}
    </div>
  );
}

function BasemapPicker({ active, onSelect }: { active: string; onSelect: (id: string) => void }) {
  return (
    <div>
      <p className="display-tight px-1 text-sm">Basemap</p>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {BASEMAPS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => onSelect(entry.id)}
            className={cn(
              'rounded-lg border px-2.5 py-2 text-left text-xs transition-colors',
              entry.id === active
                ? 'border-primary/40 bg-primary/12 text-primary'
                : 'border-border/60 bg-surface-muted hover:bg-surface-muted/80 text-muted-foreground hover:text-foreground',
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function LayerGroup({
  label,
  layers,
  enabled,
  counts,
  onToggle,
}: {
  label: string;
  layers: ReadonlyArray<(typeof LAYERS)[number]>;
  enabled: ReadonlySet<string>;
  counts: Record<string, number>;
  onToggle: (id: string, value: boolean) => void;
}) {
  const visibleCount = layers.filter((layer) => enabled.has(layer.id)).length;
  return (
    <div>
      <div className="flex items-center justify-between px-1">
        <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
          {label}
        </p>
        {visibleCount > 0 ? (
          <span className="text-muted-foreground/70 text-[10px]">{visibleCount} on</span>
        ) : null}
      </div>
      <div className="mt-1.5 space-y-1">
        {layers.map((layer) => {
          const isSupported = SUPPORTED_DATA_LAYERS.has(layer.id);
          const isOn = enabled.has(layer.id);
          const count = counts[layer.id];
          return (
            <div
              key={layer.id}
              className={cn(
                'flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors',
                isSupported && 'hover:bg-surface-muted/70',
                !isSupported && 'opacity-60',
              )}
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: layer.accent }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-xs font-medium">
                  {layer.label}
                  {!isSupported ? (
                    <Lock className="text-muted-foreground/70 size-3" aria-label="Needs a live feed or API key" />
                  ) : null}
                </p>
                {isSupported && count !== undefined ? (
                  <p className="text-muted-foreground/80 text-[10px]">
                    {layer.description}
                    <span className="text-muted-foreground"> · {count.toLocaleString()}</span>
                  </p>
                ) : (
                  <p className="text-muted-foreground/80 truncate text-[10px]">{layer.description}</p>
                )}
              </div>
              <Switch
                checked={isOn}
                disabled={!isSupported}
                onCheckedChange={(value) => onToggle(layer.id, value)}
                aria-label={`Toggle ${layer.label}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
