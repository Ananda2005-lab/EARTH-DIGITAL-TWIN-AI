import type {
  Airport,
  FlightState,
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  HazardEvent,
  HazardKind,
  HazardSeverity,
  LngLat,
  Seaport,
  VesselKind,
  VesselState,
} from '@edt/shared';
import { altitudeColor, depthColor } from '@edt/shared';

import type { CountryOutline } from '../globe/country-geometry';

export type { GeoJsonFeatureCollection };

/** Severity → colour, matching the globe's hazard markers exactly. */
export const SEVERITY_COLOR: Record<HazardSeverity, string> = {
  info: '#94a3b8',
  low: '#38bdf8',
  moderate: '#facc15',
  high: '#fb923c',
  extreme: '#ef4444',
};

const VESSEL_COLOR: Record<VesselKind, string> = {
  cargo: '#38bdf8',
  tanker: '#f97316',
  passenger: '#4ade80',
  fishing: '#a78bfa',
  tug: '#facc15',
  sailing: '#22d3ee',
  high_speed: '#fb7185',
  military: '#e2e8f0',
  pleasure: '#f472b6',
  other: '#64748b',
};

/**
 * Layers whose data is wired up for 2D rendering. Everything else in the
 * catalogue stays visible in the manager, marked as needing a live feed or an
 * operator API key.
 */
export const SUPPORTED_DATA_LAYERS = new Set<string>([
  'borders',
  'labels',
  'graticule',
  'day_night',
  'timezones',
  'terrain_mesh',
  'temperature',
  'precipitation',
  'clouds',
  'wind',
  'pressure',
  'air_quality',
  'earthquakes',
  'wildfires',
  'volcanoes',
  'floods',
  'cyclones',
  'sst',
  'wave_height',
  'sea_ice',
  'ocean_currents',
  'solar_radiation',
  'vegetation_ndvi',
  'snow_cover',
  'night_luminosity',
  'aurora',
  'satellites',
  'flights',
  'ships',
  'iss',
  'airports',
  'seaports',
]);

const HAZARD_KINDS: Record<string, HazardKind[]> = {
  earthquakes: ['earthquake'],
  wildfires: ['wildfire'],
  volcanoes: ['volcano'],
  floods: ['flood'],
  cyclones: ['cyclone'],
};

export interface MapData {
  hazards: HazardEvent[];
  flights: FlightState[];
  vessels: VesselState[];
  iss: { position: LngLat; name: string } | null;
  issTrack: LngLat[];
  airports: readonly Airport[];
  seaports: readonly Seaport[];
}

function pointFeature(
  id: string,
  position: LngLat,
  properties: Record<string, unknown>,
): GeoJsonFeature {
  return {
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [position.lng, position.lat] },
    properties,
  };
}

function collection(features: GeoJsonFeature[]): GeoJsonFeatureCollection {
  return { type: 'FeatureCollection', features };
}

export function hazardsForLayer(
  events: HazardEvent[],
  layerId: string,
): GeoJsonFeatureCollection {
  const kinds = HAZARD_KINDS[layerId];
  if (!kinds) return collection([]);
  const features = events
    .filter((event) => kinds.includes(event.kind))
    .map((event) => {
      const properties: HazardProperties = {
        kind: event.kind,
        severity: event.severity,
        color: SEVERITY_COLOR[event.severity],
        title: event.title,
        place: event.place ?? `${event.location.lat.toFixed(2)}, ${event.location.lng.toFixed(2)}`,
        magnitude: event.magnitude,
        depth: event.depthKm,
        source: event.source,
      };
      return pointFeature(event.id, event.location, {
        ...properties,
        radius: hazardPropertyRadius(properties),
      });
    });
  return collection(features);
}

export function flightsToGeoJson(flights: FlightState[]): GeoJsonFeatureCollection {
  return collection(
    flights.map((flight) =>
      pointFeature(flight.icao24, flight.position, {
        callsign: flight.callsign ?? flight.icao24,
        color: altitudeColor(flight.altitude),
        altitude: flight.altitude,
        velocity: flight.velocity,
        heading: flight.heading,
        origin: flight.originCountry,
        phase: flight.phase,
      }),
    ),
  );
}

export function vesselsToGeoJson(vessels: VesselState[]): GeoJsonFeatureCollection {
  return collection(
    vessels.map((vessel) =>
      pointFeature(vessel.mmsi, vessel.position, {
        name: vessel.name ?? vessel.mmsi,
        color: VESSEL_COLOR[vessel.kind],
        kind: vessel.kind,
        sog: vessel.sog,
        destination: vessel.destination,
        flag: vessel.flagCountryCode,
      }),
    ),
  );
}

export function airportsToGeoJson(airports: readonly Airport[]): GeoJsonFeatureCollection {
  return collection(
    airports.map((airport) =>
      pointFeature(airport.icao, airport.location, {
        name: airport.name,
        city: airport.city,
        code: airport.iata ?? airport.icao,
        color: '#fdba74',
      }),
    ),
  );
}

export function seaportsToGeoJson(seaports: readonly Seaport[]): GeoJsonFeatureCollection {
  return collection(
    seaports.map((port) =>
      pointFeature(port.code, port.location, {
        name: port.name,
        code: port.code,
        teu: port.teu,
        color: '#7dd3fc',
      }),
    ),
  );
}

export function issToGeoJson(iss: { position: LngLat; name: string } | null): GeoJsonFeatureCollection {
  if (!iss) return collection([]);
  return collection([
    pointFeature('iss', iss.position, { name: iss.name, color: '#e879f9' }),
  ]);
}

/** ISS ground track as a polyline. */
export function issTrackToGeoJson(track: LngLat[]): GeoJsonFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: track.map((p) => [p.lng, p.lat]),
        },
        properties: { color: '#e879f9' },
      },
    ],
  };
}

/** Country borders from the bundled 110 m outlines as line features. */
export function bordersToGeoJson(outlines: CountryOutline[]): GeoJsonFeatureCollection {
  const features: GeoJsonFeature[] = outlines
    .map((outline, index) =>
      outline.rings.map((ring, ringIndex) =>
        pointLineFeature(`border:${index}:${ringIndex}`, ring, {
          code: outline.code,
          name: outline.name,
        }),
      ),
    )
    .flat();
  return collection(features);
}

function pointLineFeature(
  id: string,
  ring: [number, number][],
  properties: Record<string, unknown>,
): GeoJsonFeature {
  return {
    type: 'Feature',
    id,
    geometry: { type: 'LineString', coordinates: ring },
    properties,
  };
}

export interface HazardProperties {
  kind?: HazardKind;
  severity?: HazardSeverity;
  title?: string;
  place?: string;
  magnitude?: number;
  depth?: number;
  color?: string;
  source?: string;
  radius?: number;
}

export function hazardPropertyColor(properties: HazardProperties): string {
  if (properties.color) return properties.color;
  return SEVERITY_COLOR[properties.severity ?? 'info'];
}

export function hazardPropertyRadius(properties: HazardProperties): number {
  if (properties.kind === 'earthquake') {
    const depth = properties.depth ?? 0;
    const magnitude = properties.magnitude ?? 2;
    return 4 + Math.min(8, magnitude * 0.9) - Math.min(3, depth / 150);
  }
  return 5 + (properties.severity === 'extreme' ? 4 : properties.severity === 'high' ? 2.5 : 0);
}

/** Resolve the latest RainViewer radar frame and build the XYZ tile template. */
export async function resolveRadarTileTemplate(): Promise<string | null> {
  try {
    const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
    if (!response.ok) return null;
    const data = (await response.json()) as { radar?: { past?: { time: number }[] } };
    const frames = data.radar?.past;
    const latest = Array.isArray(frames) && frames.length > 0 ? frames[frames.length - 1] : undefined;
    if (!latest?.time) return null;
    return `https://tilecache.rainviewer.com/v2/radar/${latest.time}/256/{z}/{x}/{y}/2/1_1.png`;
  } catch {
    return null;
  }
}

/**
 * Real-time weather / ocean rasters served by the Open-Meteo map-tiles
 * gateway. Consumed through MapLibre's `om://` protocol (registered by
 * `@openmeteo/weather-map-layer`) so tiles decode straight to canvas.
 */
export interface OmRasterLayer {
  /** Full `om://` URL for a plain raster source (renders the model field). */
  url: string;
  /** Extra URL kept for the wind arrow vector source (`&arrows=true`). */
  arrowsUrl?: string;
  maxzoom: number;
}

export const OM_RASTER_LAYERS: Record<string, OmRasterLayer> = {
  temperature: {
    url: 'https://map-tiles.open-meteo.com/data_spatial/dwd_icon/latest.json?time_step=current_time_1H&variable=temperature_2m',
    maxzoom: 12,
  },
  clouds: {
    url: 'https://map-tiles.open-meteo.com/data_spatial/dwd_icon/latest.json?time_step=current_time_1H&variable=cloud_cover',
    maxzoom: 12,
  },
  pressure: {
    url: 'https://map-tiles.open-meteo.com/data_spatial/dwd_icon/latest.json?time_step=current_time_1H&variable=pressure_msl',
    maxzoom: 12,
  },
  air_quality: {
    url: 'https://map-tiles.open-meteo.com/data_spatial/cams_global/latest.json?time_step=current_time_1H&variable=pm2_5',
    maxzoom: 8,
  },
  solar_radiation: {
    url: 'https://map-tiles.open-meteo.com/data_spatial/ecmwf_ifs025/latest.json?time_step=current_time_1H&variable=shortwave_radiation',
    maxzoom: 8,
  },
  wave_height: {
    url: 'https://map-tiles.open-meteo.com/data_spatial/dwd_gwam/latest.json?time_step=current_time_3H&variable=wave_height',
    maxzoom: 8,
  },
  ocean_currents: {
    url: 'https://map-tiles.open-meteo.com/data_spatial/ecmwf_ifs025/latest.json?time_step=current_time_3H&variable=ocean_u_current&variable=ocean_v_current',
    maxzoom: 8,
  },
  wind: {
    url: 'https://map-tiles.open-meteo.com/data_spatial/dwd_icon/latest.json?time_step=current_time_1H&variable=wind_u_component_10m&variable=wind_v_component_10m',
    maxzoom: 12,
  },
};

/** The wind layer additionally renders directional arrows from the vector source. */
export const WIND_ARROWS_LAYER_ID = 'wind-arrows';

/**
 * Environmental rasters from the NASA GIBS WMTS (free, no key). GIBS uses the
 * Google Maps tile scheme with a fixed matrix set per layer; the tile template
 * keeps `{z}/{y}/{x}` so MapLibre can request them directly.
 */
export interface GibsLayer {
  layer: string;
  level: number;
}

export const GIBS_RASTER_LAYERS: Record<string, GibsLayer> = {
  sst: { layer: 'GHRSST_L4_MUR_Sea_Surface_Temperature', level: 7 },
  sea_ice: { layer: 'MODIS_Terra_Sea_Ice', level: 7 },
  snow_cover: { layer: 'MODIS_Terra_L3_NDSI_Snow_Cover_Daily', level: 8 },
  vegetation_ndvi: { layer: 'MODIS_Terra_NDVI_8Day', level: 9 },
  night_luminosity: { layer: 'VIIRS_SNPP_DayNightBand', level: 7 },
};

export function gibsTileUrl(layer: GibsLayer): string {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer.layer}/default/GoogleMapsCompatible_Level${layer.level}/{z}/{y}/{x}.png`;
}

/**
 * Keyless Esri reference overlays that sit on top of the imagery basemaps
 * (transparent PNG tiles, same host as the existing basemap catalogue).
 */
export interface EsriRasterLayer {
  url: string;
  maxzoom: number;
}

export const ESRI_RASTER_LAYERS: Record<string, EsriRasterLayer> = {
  labels: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Reference_Overlay/MapServer/tile/{z}/{y}/{x}',
    maxzoom: 12,
  },
};

/**
 * Latest NOAA SWPC OVATION auroral oval. The feed returns the oval boundary as
 * a `[longitude, latitude, probability]` sequence covering both poles; it is
 * split into per-hemisphere rings wherever consecutive points jump, so each
 * oval renders as its own dashed polyline.
 */
export async function fetchAuroraGeoJson(): Promise<GeoJsonFeatureCollection> {
  try {
    const response = await fetch('https://services.swpc.noaa.gov/json/ovation_aurora_latest.json');
    if (!response.ok) return collection([]);
    const data = (await response.json()) as {
      coordinates?: [number, number, number][];
      'Observation Time'?: string;
    };
    const points = (data.coordinates ?? [])
      .map(([lng, lat]) => [lng, lat] as [number, number])
      .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
    const rings = splitRings(points);
    return collection(
      rings.map((ring, index) => ({
        type: 'Feature' as const,
        id: `aurora:${index}`,
        geometry: { type: 'LineString', coordinates: ring },
        properties: { color: '#4ade80', time: data['Observation Time'] },
      })),
    );
  } catch {
    return collection([]);
  }
}

function splitRings(coords: [number, number][]): [number, number][][] {
  const rings: [number, number][][] = [];
  let current: [number, number][] = [];
  for (const point of coords) {
    const previous = current[current.length - 1];
    if (previous) {
      const jump =
        Math.abs(point[0] - previous[0]) > 40 || Math.abs(point[1] - previous[1]) > 40;
      if (jump && current.length > 3) {
        rings.push(current);
        current = [];
      }
    }
    current.push(point);
  }
  if (current.length > 3) rings.push(current);
  return rings;
}

/**
 * Live satellite ground positions propagated from CelesTrak TLEs with SGP4
 * (satellite.js). A curated set of operator groups keeps the payload small
 * while still covering ISS, GPS, GLONASS and Galileo.
 */
export interface SatellitePoint {
  name: string;
  norad: string;
  position: LngLat;
  altitudeKm: number;
}

const SATELLITE_GROUPS = ['stations', 'gps', 'glonass', 'galileo'] as const;

export async function fetchSatellitePositions(): Promise<SatellitePoint[]> {
  const entries: { name: string; line1: string; line2: string }[] = [];
  await Promise.all(
    SATELLITE_GROUPS.map(async (group) => {
      try {
        const response = await fetch(
          `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=3le`,
        );
        if (!response.ok) return;
        const lines = (await response.text())
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        for (let index = 0; index + 2 < lines.length; index += 3) {
          entries.push({ name: lines[index]!, line1: lines[index + 1]!, line2: lines[index + 2]! });
        }
      } catch {
        // A failing group is skipped; the rest still render.
      }
    }),
  );
  if (entries.length === 0) return [];

  const { twoline2satrec, propagate, gstime, eciToGeodetic } = await import('satellite.js');
  const now = new Date();
  const gmst = gstime(now);
  const toDegrees = (radians: number) => (radians * 180) / Math.PI;

  return entries.flatMap(({ name, line1, line2 }) => {
    const satrec = twoline2satrec(line1, line2);
    const state = propagate(satrec, now);
    const position = state.position;
    if (typeof position === 'boolean') return [];
    const geodetic = eciToGeodetic(position, gmst);
    if (!geodetic) return [];
    const latitude = toDegrees(geodetic.latitude);
    const longitude = toDegrees(geodetic.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    return [
      {
        name,
        norad: line1.slice(2, 7),
        position: { lng: longitude, lat: latitude },
        altitudeKm: geodetic.height,
      },
    ];
  });
}

export function satellitesToGeoJson(points: SatellitePoint[]): GeoJsonFeatureCollection {
  return collection(
    points.map((satellite) =>
      pointFeature(satellite.norad, satellite.position, {
        name: satellite.name,
        color: '#c4b5fd',
        altitudeKm: Math.round(satellite.altitudeKm),
      }),
    ),
  );
}

/**
 * Graticule grid — one meridian + one parallel every 10 degrees, drawn as a
 * thin reference overlay matching the shared catalogue's `graticule` layer.
 */
export function graticuleToGeoJson(): GeoJsonFeatureCollection {
  const features: GeoJsonFeature[] = [];
  for (let lat = -80; lat <= 80; lat += 10) {
    const coordinates: [number, number][] = [];
    for (let lng = -180; lng <= 180; lng += 5) coordinates.push([lng, lat]);
    features.push({
      type: 'Feature',
      id: `graticule:lat:${lat}`,
      geometry: { type: 'LineString', coordinates },
      properties: { color: '#475569' },
    });
  }
  for (let lng = -180; lng <= 180; lng += 10) {
    const coordinates: [number, number][] = [];
    for (let lat = -90; lat <= 90; lat += 5) coordinates.push([lng, lat]);
    features.push({
      type: 'Feature',
      id: `graticule:lng:${lng}`,
      geometry: { type: 'LineString', coordinates },
      properties: { color: '#475569' },
    });
  }
  return collection(features);
}

/**
 * Day / night terminator for a given instant. Returns the night-side polygon
 * (filled) plus the terminator polyline, computed from the solar declination
 * and the subsolar longitude so the map stays correct across seasons.
 */
export function terminatorToGeoJson(date: Date): GeoJsonFeatureCollection {
  const subsolar = subsolarPoint(date);
  const declination = subsolar.lat;
  const subsolarLng = subsolar.lng;
  const nightPole = declination >= 0 ? -90 : 90;

  const ring: [number, number][] = [];
  for (let lng = -180; lng <= 180; lng += 3) {
    const h = (lng - subsolarLng) * (Math.PI / 180);
    const delta = declination * (Math.PI / 180);
    const phi = Math.atan((-Math.cos(delta) * Math.cos(h)) / Math.sin(delta)) * (180 / Math.PI);
    ring.push([lng, Number.isFinite(phi) ? phi : nightPole]);
  }

  const pole = nightPole;
  const nightRing: [number, number][] = [...ring, [180, pole], [-180, pole]];

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'day-night:polygon',
        geometry: { type: 'Polygon', coordinates: [nightRing] },
        properties: { color: '#0b1220', fill: true },
      },
      {
        type: 'Feature',
        id: 'day-night:terminator',
        geometry: { type: 'LineString', coordinates: ring },
        properties: { color: '#64748b', fill: false },
      },
    ],
  };
}

export function subsolarPoint(date: Date): LngLat {
  const days = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86_400_000;
  const rad = (d: number) => d * (Math.PI / 180);
  const deg = (r: number) => (r * 180) / Math.PI;
  const l = (280.46 + 0.9856474 * days) % 360;
  const g = (357.528 + 0.9856003 * days) % 360;
  const lambda = (l + 1.915 * Math.sin(rad(g)) + 0.02 * Math.sin(rad(2 * g))) % 360;
  const epsilon = 23.439 - 0.0000004 * days;
  const declination = deg(Math.asin(Math.sin(rad(epsilon)) * Math.sin(rad(lambda))));
  const ra = deg(Math.atan2(Math.cos(rad(epsilon)) * Math.sin(rad(lambda)), Math.cos(rad(lambda))));
  const gst = (280.46061837 + 360.98564736629 * days) % 360;
  let lng = ra - gst;
  lng = ((lng + 540) % 360) - 180;
  return { lng, lat: declination };
}

export const DEFAULT_MAP_CENTER: LngLat = { lng: 12.4964, lat: 25.0 };
export const DEFAULT_MAP_ZOOM = 2;

/**
 * Keyless public DEM tiles (Mapzen terrarium encoding) used by the terrain
 * mesh layer via MapLibre's raster-dem source + setTerrain.
 */
export const TERRAIN_DEM_URL =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

/**
 * IANA time zone polygons (Natural Earth 10m, bundled so the layer works
 * offline). Fetched once per session on the client when the layer toggles on.
 */
let cachedTimezones: GeoJsonFeatureCollection | null = null;

export async function fetchTimezonePolygons(): Promise<GeoJsonFeatureCollection> {
  if (cachedTimezones) return cachedTimezones;
  const response = await fetch('/data/timezones-10m.json');
  cachedTimezones = (await response.json()) as GeoJsonFeatureCollection;
  return cachedTimezones;
}

/** Live counts for each supported data layer, shown next to the toggles. */
export function layerCounts(data: MapData): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of ['earthquakes', 'wildfires', 'volcanoes', 'floods', 'cyclones'] as const) {
    counts[id] = hazardsForLayer(data.hazards, id).features.length;
  }
  counts.flights = data.flights.length;
  counts.ships = data.vessels.length;
  counts.iss = data.iss ? 1 : 0;
  counts.airports = data.airports.length;
  counts.seaports = data.seaports.length;
  return counts;
}
