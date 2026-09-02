/**
 * Stacking altitudes for globe layer classes, as multipliers of GLOBE_RADIUS.
 *
 * Every layer renders slightly above the sphere so nothing z-fights. The
 * ordering here is the single source of truth: vectors sit closest to the
 * surface, point markers float above them, labels on top.
 */
export const LAYER_ALTITUDE = {
  /** Shading shells such as the night-side dimmer. */
  shell: 1.0005,
  /** Vector lines: borders, graticule, solar terminator. */
  surface: 1.002,
  /** Billboarded point markers: hazards, flights, ships, satellites. */
  markers: 1.01,
  /** Hover tooltips and labels. */
  labels: 1.02,
} as const;

export type LayerAltitudeClass = keyof typeof LAYER_ALTITUDE;
