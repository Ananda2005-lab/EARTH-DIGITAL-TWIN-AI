/**
 * Core geospatial primitives shared by every service in the platform.
 * All coordinates are WGS84 (EPSG:4326) unless explicitly stated.
 */

/** Longitude / latitude pair in decimal degrees. */
export interface LngLat {
  lng: number;
  lat: number;
}

/** Position with optional altitude in metres above the WGS84 ellipsoid. */
export interface GeoPoint extends LngLat {
  altitude?: number;
}

/** Axis-aligned bounding box: [west, south, east, north]. */
export type BBox = [west: number, south: number, east: number, north: number];

/** Camera state for the 3D globe / 2D map, persisted in URLs and workspaces. */
export interface ViewState {
  /** Center longitude in degrees. */
  lng: number;
  /** Center latitude in degrees. */
  lat: number;
  /** Camera distance from the surface, in metres. */
  altitude: number;
  /** Compass heading in degrees, 0 = north. */
  bearing: number;
  /** Tilt in degrees, 0 = straight down. */
  pitch: number;
}

export const DEFAULT_VIEW_STATE: ViewState = {
  lng: 12.4964,
  lat: 25.0,
  altitude: 14_000_000,
  bearing: 0,
  pitch: 0,
};

/** Distance units supported across the UI. */
export type DistanceUnit = 'metric' | 'imperial';

/** Temperature units supported across the UI. */
export type TemperatureUnit = 'celsius' | 'fahrenheit';

/** A named place resolved by the geocoder or global search. */
export interface Place {
  id: string;
  name: string;
  /** Human readable hierarchy, e.g. "Kyoto, Kansai, Japan". */
  label: string;
  kind: PlaceKind;
  countryCode?: string;
  admin1?: string;
  population?: number;
  timezone?: string;
  center: LngLat;
  bbox?: BBox;
  /** Relevance score 0..1 produced by the search ranker. */
  score?: number;
}

export type PlaceKind =
  | 'country'
  | 'region'
  | 'city'
  | 'town'
  | 'village'
  | 'landmark'
  | 'airport'
  | 'seaport'
  | 'mountain'
  | 'island'
  | 'water'
  | 'protected_area'
  | 'coordinate'
  | 'other';

/** Minimal GeoJSON typings (avoids a runtime dependency on @types/geojson). */
export type GeoJsonGeometryType =
  | 'Point'
  | 'MultiPoint'
  | 'LineString'
  | 'MultiLineString'
  | 'Polygon'
  | 'MultiPolygon'
  | 'GeometryCollection';

export interface GeoJsonGeometry {
  type: GeoJsonGeometryType;
  coordinates?: unknown;
  geometries?: GeoJsonGeometry[];
}

export interface GeoJsonFeature<P = Record<string, unknown>> {
  type: 'Feature';
  id?: string | number;
  geometry: GeoJsonGeometry | null;
  properties: P;
  bbox?: BBox;
}

export interface GeoJsonFeatureCollection<P = Record<string, unknown>> {
  type: 'FeatureCollection';
  features: GeoJsonFeature<P>[];
  bbox?: BBox;
}
