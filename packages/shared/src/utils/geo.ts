import type { BBox, LngLat } from '../types/geo';

export const EARTH_RADIUS_M = 6_371_008.8;
export const EARTH_CIRCUMFERENCE_M = 2 * Math.PI * EARTH_RADIUS_M;

export const toRadians = (deg: number): number => (deg * Math.PI) / 180;
export const toDegrees = (rad: number): number => (rad * 180) / Math.PI;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normaliseLongitude(lng: number): number {
  let x = ((((lng + 180) % 360) + 360) % 360) - 180;
  if (x === -180) x = 180;
  return x;
}

export function clampLatitude(lat: number): number {
  return clamp(lat, -90, 90);
}

/** Great-circle distance in metres using the haversine formula. */
export function haversineDistance(a: LngLat, b: LngLat): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing in degrees from `a` to `b`. */
export function initialBearing(a: LngLat, b: LngLat): number {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const dLng = toRadians(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

/** Point at `distanceM` along the great circle from `origin` on `bearingDeg`. */
export function destinationPoint(origin: LngLat, bearingDeg: number, distanceM: number): LngLat {
  const delta = distanceM / EARTH_RADIUS_M;
  const theta = toRadians(bearingDeg);
  const phi1 = toRadians(origin.lat);
  const lambda1 = toRadians(origin.lng);
  const sinPhi2 =
    Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta);
  const phi2 = Math.asin(clamp(sinPhi2, -1, 1));
  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * sinPhi2,
    );
  return { lng: normaliseLongitude(toDegrees(lambda2)), lat: toDegrees(phi2) };
}

/** Interpolate `steps` points along the great circle between two coordinates. */
export function greatCircleArc(a: LngLat, b: LngLat, steps = 64): LngLat[] {
  const d = haversineDistance(a, b) / EARTH_RADIUS_M;
  if (d === 0) return [a, b];
  const points: LngLat[] = [];
  const phi1 = toRadians(a.lat);
  const lambda1 = toRadians(a.lng);
  const phi2 = toRadians(b.lat);
  const lambda2 = toRadians(b.lng);
  for (let i = 0; i <= steps; i += 1) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(phi1) * Math.cos(lambda1) + B * Math.cos(phi2) * Math.cos(lambda2);
    const y = A * Math.cos(phi1) * Math.sin(lambda1) + B * Math.cos(phi2) * Math.sin(lambda2);
    const z = A * Math.sin(phi1) + B * Math.sin(phi2);
    points.push({
      lat: toDegrees(Math.atan2(z, Math.sqrt(x * x + y * y))),
      lng: normaliseLongitude(toDegrees(Math.atan2(y, x))),
    });
  }
  return points;
}

export function bboxFromCenter(center: LngLat, radiusM: number): BBox {
  const latDelta = toDegrees(radiusM / EARTH_RADIUS_M);
  const lngDelta = toDegrees(radiusM / (EARTH_RADIUS_M * Math.cos(toRadians(center.lat)) || 1e-6));
  return [
    normaliseLongitude(center.lng - lngDelta),
    clampLatitude(center.lat - latDelta),
    normaliseLongitude(center.lng + lngDelta),
    clampLatitude(center.lat + latDelta),
  ];
}

export function bboxCenter(bbox: BBox): LngLat {
  return { lng: (bbox[0] + bbox[2]) / 2, lat: (bbox[1] + bbox[3]) / 2 };
}

export function bboxContains(bbox: BBox, point: LngLat): boolean {
  const [w, s, e, n] = bbox;
  const inLat = point.lat >= s && point.lat <= n;
  const inLng = w <= e ? point.lng >= w && point.lng <= e : point.lng >= w || point.lng <= e;
  return inLat && inLng;
}

export function expandBBox(bbox: BBox, factor: number): BBox {
  const c = bboxCenter(bbox);
  const halfW = ((bbox[2] - bbox[0]) / 2) * factor;
  const halfH = ((bbox[3] - bbox[1]) / 2) * factor;
  return [
    normaliseLongitude(c.lng - halfW),
    clampLatitude(c.lat - halfH),
    normaliseLongitude(c.lng + halfW),
    clampLatitude(c.lat + halfH),
  ];
}

/** Approximate bbox area in km². */
export function bboxAreaKm2(bbox: BBox): number {
  const [w, s, e, n] = bbox;
  const widthKm =
    haversineDistance({ lng: w, lat: (s + n) / 2 }, { lng: e, lat: (s + n) / 2 }) / 1000;
  const heightKm = haversineDistance({ lng: w, lat: s }, { lng: w, lat: n }) / 1000;
  return widthKm * heightKm;
}

/** Web-Mercator zoom level that fits the given bbox into a viewport. */
export function zoomForBBox(bbox: BBox, viewportWidth = 1280, viewportHeight = 720): number {
  const [w, s, e, n] = bbox;
  const lngSpan = Math.abs(e - w) || 0.01;
  const latSpan = Math.abs(n - s) || 0.01;
  const zoomX = Math.log2((360 * viewportWidth) / (256 * lngSpan));
  const zoomY = Math.log2((180 * viewportHeight) / (256 * latSpan));
  return clamp(Math.min(zoomX, zoomY), 0, 20);
}

/** Camera altitude (metres) roughly equivalent to a Mercator zoom level. */
export function altitudeForZoom(zoom: number, latitude = 0): number {
  const metresPerPixel =
    (EARTH_CIRCUMFERENCE_M * Math.cos(toRadians(latitude))) / (256 * 2 ** zoom);
  return metresPerPixel * 1000;
}

export function zoomForAltitude(altitude: number, latitude = 0): number {
  const metresPerPixel = altitude / 1000;
  return clamp(
    Math.log2((EARTH_CIRCUMFERENCE_M * Math.cos(toRadians(latitude))) / (256 * metresPerPixel)),
    0,
    20,
  );
}

/** Convert lng/lat to a unit-sphere cartesian vector (three.js Y-up convention). */
export function lngLatToVector3(lng: number, lat: number, radius = 1): [number, number, number] {
  const phi = toRadians(90 - lat);
  const theta = toRadians(lng + 180);
  return [
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ];
}

export function vector3ToLngLat(x: number, y: number, z: number): LngLat {
  const radius = Math.sqrt(x * x + y * y + z * z) || 1;
  const lat = 90 - toDegrees(Math.acos(clamp(y / radius, -1, 1)));
  const lng = normaliseLongitude(toDegrees(Math.atan2(z, -x)) - 180);
  return { lng, lat };
}

/** Sub-solar point (where the sun is directly overhead) for a given instant. */
export function subsolarPoint(date: Date): LngLat {
  const julian = date.getTime() / 86_400_000 + 2_440_587.5;
  const n = julian - 2_451_545.0;
  const meanLongitude = (280.46 + 0.9856474 * n) % 360;
  const meanAnomaly = toRadians((357.528 + 0.9856003 * n) % 360);
  const eclipticLongitude = toRadians(
    meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly),
  );
  const obliquity = toRadians(23.439 - 0.0000004 * n);
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const rightAscension = Math.atan2(
    Math.cos(obliquity) * Math.sin(eclipticLongitude),
    Math.cos(eclipticLongitude),
  );
  const lng = normaliseLongitude(toDegrees(rightAscension) - gmst * 15);
  return { lng, lat: toDegrees(declination) };
}

/** Solar elevation angle in degrees at a location and instant. */
export function solarElevation(point: LngLat, date: Date): number {
  const sun = subsolarPoint(date);
  const angular = haversineDistance(point, sun) / EARTH_RADIUS_M;
  return 90 - toDegrees(angular);
}

export function isDaylight(point: LngLat, date = new Date()): boolean {
  return solarElevation(point, date) > -0.833;
}

/** Ray-casting point-in-polygon test for a single linear ring. */
export function pointInRing(point: LngLat, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i]!;
    const b = ring[j]!;
    const intersects =
      a[1] > point.lat !== b[1] > point.lat &&
      point.lng < ((b[0] - a[0]) * (point.lat - a[1])) / (b[1] - a[1]) + a[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Centroid of a set of coordinates, weighted equally. */
export function centroid(points: LngLat[]): LngLat {
  if (points.length === 0) return { lng: 0, lat: 0 };
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of points) {
    const [vx, vy, vz] = lngLatToVector3(p.lng, p.lat, 1);
    x += vx;
    y += vy;
    z += vz;
  }
  return vector3ToLngLat(x / points.length, y / points.length, z / points.length);
}
