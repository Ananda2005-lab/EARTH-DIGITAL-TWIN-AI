'use client';

import {
  DEFAULT_LAYER_IDS,
  LAYERS,
  type LayerDefinition,
} from '@edt/shared';
import * as React from 'react';

/**
 * Client-side layer selection for the globe.
 *
 * The catalogue itself lives in `@edt/shared` so the API validates the same
 * ids. This module only tracks *which* layers are switched on and whether a
 * layer has a renderer in the current scene yet: `live` layers toggle
 * immediately, `planned` ones show as disabled in the panel until their
 * renderer lands.
 */

export type LayerStatus = 'live' | 'planned';

/** Layers whose renderers exist in the current globe scene. */
const LIVE_LAYER_IDS = new Set([
  // Reference
  'borders',
  'graticule',
  'day_night',
  // Live transport feeds
  'flights',
  'ships',
  'airports',
  'seaports',
  // Space
  'satellites',
  'iss',
]);

/** Hazard category: always rendered through the fused hazard feed. */
const ALWAYS_ON_CATEGORIES = new Set(['hazard']);

export function layerStatus(layer: LayerDefinition): LayerStatus {
  if (LIVE_LAYER_IDS.has(layer.id) || ALWAYS_ON_CATEGORIES.has(layer.category)) {
    return 'live';
  }
  return 'planned';
}

export function isLayerLive(layer: LayerDefinition): boolean {
  return layerStatus(layer) === 'live';
}

/** Live layers that can actually be toggled (hazards are always on). */
export const TOGGLEABLE_LAYERS: readonly LayerDefinition[] = LAYERS.filter(
  (layer) => LIVE_LAYER_IDS.has(layer.id),
);

const STORAGE_KEY = 'edt.globe.layers';

function defaultSelection(): string[] {
  return DEFAULT_LAYER_IDS.filter((id) => LIVE_LAYER_IDS.has(id));
}

/**
 * Persisted layer selection. Hydrates from localStorage after mount so the
 * server render never mismatches the stored value.
 */
export function useLayerSelection() {
  const [enabledIds, setEnabledIds] = React.useState<string[]>(defaultSelection);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setEnabledIds(parsed.filter((id): id is string => typeof id === 'string'));
        }
      }
    } catch {
      // Corrupt storage falls back to defaults silently.
    }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(enabledIds));
    } catch {
      // Private mode / quota — selection simply won't persist.
    }
  }, [enabledIds, hydrated]);

  const toggle = React.useCallback((id: string) => {
    setEnabledIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  }, []);

  const isEnabled = React.useCallback((id: string) => enabledIds.includes(id), [enabledIds]);

  /** Enabled layers sorted by draw order, lowest first. */
  const enabledLayers = React.useMemo(
    () =>
      LAYERS.filter((layer) => enabledIds.includes(layer.id)).sort((a, b) => a.order - b.order),
    [enabledIds],
  );

  return { enabledIds, enabledLayers, toggle, isEnabled, hydrated };
}
