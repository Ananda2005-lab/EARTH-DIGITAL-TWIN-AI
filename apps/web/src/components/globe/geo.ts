import type { LngLat } from '@edt/shared';
import * as THREE from 'three';

/**
 * Shared lng/lat ⇄ 3D conversion for every globe layer.
 *
 * The convention (poles on Y, seam at ±180° longitude) has to be identical
 * across the base sphere, borders, markers and camera fly-to math, or layers
 * drift apart as the globe rotates. Everything in `components/globe` imports
 * from here rather than reimplementing the trig.
 */
export function lngLatToVector3(
  point: LngLat,
  radius: number,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  const phi = ((90 - point.lat) * Math.PI) / 180;
  const theta = ((point.lng + 180) * Math.PI) / 180;
  out.x = -radius * Math.sin(phi) * Math.cos(theta);
  out.y = radius * Math.cos(phi);
  out.z = radius * Math.sin(phi) * Math.sin(theta);
  return out;
}

/** Inverse of `lngLatToVector3` — used to read back where a raycast hit the sphere. */
export function vector3ToLngLat(vector: THREE.Vector3): LngLat {
  const radius = vector.length();
  const phi = Math.acos(THREE.MathUtils.clamp(vector.y / radius, -1, 1));
  const theta = Math.atan2(vector.z, -vector.x);
  const lng = (theta * 180) / Math.PI - 180;
  return {
    lat: 90 - (phi * 180) / Math.PI,
    // Normalise into [-180, 180] since atan2 alone can land at -360..180.
    lng: ((lng + 540) % 360) - 180,
  };
}

export const GLOBE_RADIUS = 100;
