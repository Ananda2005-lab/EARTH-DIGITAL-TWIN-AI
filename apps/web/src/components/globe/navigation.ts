import type { LngLat } from '@edt/shared';

/**
 * Spherical navigation helpers shared by the globe layers.
 * All angles in degrees unless noted; the Earth is treated as a unit sphere.
 */

const EARTH_RADIUS_KM = 6_371;
const DEG = Math.PI / 180;

/** Great-circle distance between two coordinates in kilometres. */
export function haversineKm(a: LngLat, b: LngLat): number {
  const dLat = (b.lat - a.lat) * DEG;
  const dLng = (b.lng - a.lng) * DEG;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from `a` to `b` in degrees clockwise from north. */
export function initialBearing(a: LngLat, b: LngLat): number {
  const y = Math.sin((b.lng - a.lng) * DEG) * Math.cos(b.lat * DEG);
  const x =
    Math.cos(a.lat * DEG) * Math.sin(b.lat * DEG) -
    Math.sin(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.cos((b.lng - a.lng) * DEG);
  return (Math.atan2(y, x) / DEG + 360) % 360;
}

/**
 * The point on Earth where the sun is directly overhead at `date`.
 *
 * Low-precision solar model (±0.01° declination, ±1 min equation of time) —
 * plenty for drawing the day/night terminator, and it needs no ephemeris
 * dependency. Longitude comes straight from UTC time: noon at Greenwich when
 * the UTC hour is 12.
 */
export function subsolarPoint(date: Date): LngLat {
  const dayOfYear =
    (date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86_400_000;

  // Solar declination via the Cooper approximation.
  const declination = 23.44 * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81));

  // Subsolar longitude drifts 15° west per hour from Greenwich noon.
  const utcHours =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const lng = ((12 - utcHours) * 15 + 540) % 360 - 180;

  return { lat: declination, lng };
}

/**
 * Destination point reached by travelling `distanceDeg` along a great circle
 * from `origin` at `bearingDeg`. Used to trace the solar terminator, which is
 * the great circle 90° away from the subsolar point.
 */
export function destinationPoint(origin: LngLat, bearingDeg: number, distanceDeg: number): LngLat {
  const lat1 = origin.lat * DEG;
  const lng1 = origin.lng * DEG;
  const bearing = bearingDeg * DEG;
  const delta = distanceDeg * DEG;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(delta) + Math.cos(lat1) * Math.sin(delta) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(delta) * Math.cos(lat1),
      Math.cos(delta) - Math.sin(lat1) * Math.sin(lat2),
    );

  return { lat: lat2 / DEG, lng: ((lng2 / DEG + 540) % 360) - 180 };
}
