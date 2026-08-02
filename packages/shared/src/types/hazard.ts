import type { BBox, LngLat } from './geo';

export type HazardKind =
  | 'earthquake'
  | 'wildfire'
  | 'volcano'
  | 'flood'
  | 'cyclone'
  | 'drought'
  | 'landslide'
  | 'tsunami';

export type HazardSeverity = 'info' | 'low' | 'moderate' | 'high' | 'extreme';

export interface HazardEvent {
  id: string;
  kind: HazardKind;
  title: string;
  severity: HazardSeverity;
  /** Normalised 0..1 intensity used for colour ramps and sorting. */
  intensity: number;
  location: LngLat;
  /** Depth in km for earthquakes, elevation for volcanoes. */
  depthKm?: number;
  magnitude?: number;
  /** Fire radiative power in MW for wildfires. */
  frpMw?: number;
  /** Estimated affected population, when the provider supplies it. */
  affectedPopulation?: number;
  place?: string;
  countryCode?: string;
  startedAt: string;
  updatedAt: string;
  source: string;
  sourceUrl?: string;
  tsunamiWarning?: boolean;
  bbox?: BBox;
}

export interface HazardQuery {
  kinds?: HazardKind[];
  bbox?: BBox;
  minMagnitude?: number;
  minSeverity?: HazardSeverity;
  since?: string;
  until?: string;
  limit?: number;
}

export interface HazardFeed {
  events: HazardEvent[];
  total: number;
  window: { from: string; to: string };
  attribution: string;
  fetchedAt: string;
}

export interface HazardStats {
  kind: HazardKind;
  count: number;
  maxIntensity: number;
  bySeverity: Record<HazardSeverity, number>;
}
