import type { CountryOutline } from './country-geometry';

/**
 * Ray-casting point-in-polygon test, evaluated once per ring and XOR'd across
 * rings so holes (a ring nested inside another) correctly subtract.
 */
function pointInRing(lng: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Finds which country (if any) contains a lng/lat point.
 *
 * Called with the coordinate under the pointer after raycasting the globe
 * sphere, so this runs at most once per pointer move — a linear scan over 177
 * countries is fine at that rate. Multi-polygon countries (islands, exclaves)
 * are handled by checking every ring, not just the first.
 */
export function findCountryAt(
  outlines: CountryOutline[],
  lng: number,
  lat: number,
): CountryOutline | null {
  for (const outline of outlines) {
    for (const ring of outline.rings) {
      if (pointInRing(lng, lat, ring)) return outline;
    }
  }
  return null;
}
