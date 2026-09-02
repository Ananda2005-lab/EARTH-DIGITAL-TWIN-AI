'use client';

import {
  LAYERS,
  LAYER_CATEGORY_LABEL,
  LAYER_CATEGORY_ORDER,
  type LayerDefinition,
} from '@edt/shared';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

import { layerStatus } from './layers';

/**
 * Layer manager panel for the globe HUD.
 *
 * Driven straight from the shared catalogue: live layers toggle the renderer,
 * always-on categories (hazards) show as locked on, and planned layers render
 * disabled with a "Soon" badge so the catalogue stays honest about coverage.
 */
export function LayerPanel({
  enabledIds,
  onToggle,
}: {
  enabledIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <Card className="animate-fade-in-up absolute right-4 top-20 z-overlay max-h-[calc(100vh-12rem)] w-72 overflow-y-auto p-3">
      <h3 className="display-tight px-1 pb-2 text-sm">Map layers</h3>
      {LAYER_CATEGORY_ORDER.map((category) => {
        const layers = LAYERS.filter((layer) => layer.category === category);
        if (layers.length === 0) return null;
        return (
          <div key={category} className="mb-2">
            <p className="stat-label px-1 pb-1">{LAYER_CATEGORY_LABEL[category]}</p>
            {layers.map((layer) => (
              <LayerRow
                key={layer.id}
                layer={layer}
                enabled={enabledIds.includes(layer.id)}
                onToggle={onToggle}
              />
            ))}
          </div>
        );
      })}
    </Card>
  );
}

function LayerRow({
  layer,
  enabled,
  onToggle,
}: {
  layer: LayerDefinition;
  enabled: boolean;
  onToggle: (id: string) => void;
}) {
  const status = layerStatus(layer);
  const alwaysOn = layer.category === 'hazard';
  const toggleable = status === 'live' && !alwaysOn;

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm',
        toggleable ? 'hover:bg-surface-muted cursor-pointer' : 'opacity-60',
      )}
      onClick={toggleable ? () => onToggle(layer.id) : undefined}
      title={layer.description}
    >
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: layer.accent }}
      />
      <span className="min-w-0 flex-1 truncate">{layer.label}</span>
      {status === 'planned' ? (
        <Badge variant="neutral" className="border-none text-[10px]">
          Soon
        </Badge>
      ) : alwaysOn ? (
        <Badge variant="neutral" className="border-none text-[10px]">
          Live
        </Badge>
      ) : (
        <Switch
          checked={enabled}
          onCheckedChange={() => onToggle(layer.id)}
          aria-label={`Toggle ${layer.label} layer`}
        />
      )}
    </div>
  );
}
