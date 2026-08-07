'use client';

import {
  formatDistance,
  formatSpeed,
  getBasemap,
  getLayer,
} from '@edt/shared';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as React from 'react';

import { loadCountryOutlines, type CountryOutline } from '../globe/country-geometry';
import { MapLayerManager } from './map-layer-manager';
import {
  airportsToGeoJson,
  bordersToGeoJson,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  ESRI_RASTER_LAYERS,
  fetchAuroraGeoJson,
  fetchSatellitePositions,
  fetchTimezonePolygons,
  flightsToGeoJson,
  gibsTileUrl,
  GIBS_RASTER_LAYERS,
  graticuleToGeoJson,
  hazardsForLayer,
  issToGeoJson,
  issTrackToGeoJson,
  layerCounts,
  OM_RASTER_LAYERS,
  resolveRadarTileTemplate,
  satellitesToGeoJson,
  seaportsToGeoJson,
  SUPPORTED_DATA_LAYERS,
  terminatorToGeoJson,
  vesselsToGeoJson,
  WIND_ARROWS_LAYER_ID,
  type GeoJsonFeatureCollection,
  type MapData,
} from './map-data';

const HAZARD_LAYERS = ['earthquakes', 'wildfires', 'volcanoes', 'floods', 'cyclones'];

/** Layers rendered as clickable circles. */
const POINT_LAYERS = [
  ...HAZARD_LAYERS,
  'flights',
  'ships',
  'iss',
  'satellites',
  'airports',
  'seaports',
];

const DEFAULT_ENABLED = new Set<string>(['borders', 'day_night', 'earthquakes']);

let omProtocolReady: Promise<void> | null = null;

/**
 * Register MapLibre's `om://` protocol from the Open-Meteo weather layer once.
 * Loaded lazily and in the browser so SSR never touches the worker-backed
 * decoder.
 */
function ensureOmProtocol(): Promise<void> {
  if (!omProtocolReady) {
    omProtocolReady = import('@openmeteo/weather-map-layer').then(({ omProtocol }) => {
      maplibregl.addProtocol('om', omProtocol);
    });
  }
  return omProtocolReady;
}

export function MapShell({ data }: { data: MapData }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<maplibregl.Map | null>(null);
  const [basemap, setBasemap] = React.useState<string>(() => getBasemapId());
  const [enabled, setEnabled] = React.useState<Set<string>>(DEFAULT_ENABLED);
  const [outlines, setOutlines] = React.useState<CountryOutline[]>([]);
  const [radarUrl, setRadarUrl] = React.useState<string | null>(null);
  const [aurora, setAurora] = React.useState<GeoJsonFeatureCollection | null>(null);
  const [satellites, setSatellites] = React.useState<GeoJsonFeatureCollection | null>(null);
  const [timezones, setTimezones] = React.useState<GeoJsonFeatureCollection | null>(null);

  const basemapDefinition = getBasemap(basemap) ?? getBasemap('satellite')!;
  const counts = React.useMemo(() => layerCounts(data), [data]);

  const toggleLayer = React.useCallback((id: string, value: boolean) => {
    setEnabled((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  // Create the map once the container is mounted.
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new maplibregl.Map({
      container,
      style: {
        version: 8,
        sources: {
          basemap: {
            type: 'raster',
            tiles: [basemapDefinition.urlTemplate],
            tileSize: 256,
            maxzoom: basemapDefinition.maxZoom,
            attribution: basemapDefinition.attribution,
          },
        },
        layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
      },
      center: [DEFAULT_MAP_CENTER.lng, DEFAULT_MAP_CENTER.lat],
      zoom: DEFAULT_MAP_ZOOM,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    mapRef.current = map;

    for (const layerId of POINT_LAYERS) {
      map.on('click', layerId, (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const properties = feature.properties as Record<string, unknown> | null;
        if (!properties) return;
        new maplibregl.Popup({ closeButton: false, maxWidth: '300px' })
          .setLngLat(event.lngLat)
          .setHTML(popupContent(layerId, properties))
          .addTo(map);
      });
      map.on('mouseenter', layerId, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
      });
    }

    loadCountryOutlines().then(setOutlines).catch(() => setOutlines([]));
    void ensureOmProtocol();

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap basemap tiles in place without recreating the style.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource('basemap') as maplibregl.RasterTileSource | undefined;
    if (source) {
      source.setTiles([basemapDefinition.urlTemplate]);
    }
  }, [basemap, basemapDefinition.urlTemplate]);

  // Resolve the live radar frame once, the first time precipitation is enabled.
  React.useEffect(() => {
    if (!enabled.has('precipitation') || radarUrl !== null) return;
    let cancelled = false;
    resolveRadarTileTemplate().then((url) => {
      if (!cancelled && url) setRadarUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, radarUrl]);

  // Fetch the NOAA SWPC auroral oval once the layer is enabled.
  React.useEffect(() => {
    if (!enabled.has('aurora') || aurora !== null) return;
    let cancelled = false;
    fetchAuroraGeoJson().then((data) => {
      if (!cancelled) setAurora(data);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, aurora]);

  // Fetch the bundled time zone polygons once the layer is enabled.
  React.useEffect(() => {
    if (!enabled.has('timezones') || timezones !== null) return;
    let cancelled = false;
    fetchTimezonePolygons().then((data) => {
      if (!cancelled) setTimezones(data);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, timezones]);

  // Propagate TLEs to the current instant while the satellites layer is on,
  // refreshing every minute so positions track their orbits.
  React.useEffect(() => {
    if (!enabled.has('satellites')) return;
    let cancelled = false;
    const refresh = () => {
      fetchSatellitePositions().then((points) => {
        if (!cancelled) setSatellites(satellitesToGeoJson(points));
      });
    };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled]);

  // Synchronise sources and layers with the enabled set. Adding sources before
  // MapLibre has finished parsing the style throws, so wait for style load
  // first (React StrictMode remounts effects, which races the async style).
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let cancelled = false;
    const context: LayerContext = { data, outlines, radarUrl, aurora, satellites, timezones };
    const applyLayers = () => {
      if (cancelled) return;
      for (const layerId of SUPPORTED_DATA_LAYERS) {
        const shouldShow = enabled.has(layerId);
        const exists = map.getSource(layerId) !== undefined;
        if (shouldShow && !exists) addLayer(map, layerId, context);
        if (shouldShow && exists && (layerId === 'aurora' || layerId === 'satellites')) {
          const source = map.getSource(layerId) as maplibregl.GeoJSONSource | undefined;
          const dataForLayer = layerId === 'aurora' ? context.aurora : context.satellites;
          if (source && dataForLayer) source.setData(dataForLayer as unknown as GeoJSON.GeoJSON);
        }
        if (!shouldShow && exists) removeLayer(map, layerId);
      }
    };

    // Raster weather layers stream through the `om://` protocol; the decoder
    // registers lazily, so wait for it too before requesting tiles.
    const prepare = (): Promise<void> =>
      [...enabled].some((id) => id in OM_RASTER_LAYERS)
        ? ensureOmProtocol().then(() => undefined)
        : Promise.resolve();

    const run = () => {
      void prepare().then(() => {
        if (!cancelled && map.isStyleLoaded()) applyLayers();
      });
    };

    if (map.isStyleLoaded()) {
      run();
    } else {
      const onLoad = () => {
        map.off('load', onLoad);
        run();
      };
      map.on('load', onLoad);
      return () => {
        cancelled = true;
        map.off('load', onLoad);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [enabled, outlines, radarUrl, data, aurora, satellites, timezones]);

  return (
    <div className="map-shell">
      {/* MapLibre forces its container to `position: relative !important`, which
          would collapse an `absolute inset-0` element to zero height. Keep the
          absolute filler on an outer wrapper and size the map container with
          height/width instead. */}
      <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full" />
      </div>

      <MapLayerManager
        basemap={basemap}
        onBasemapChange={setBasemap}
        enabled={enabled}
        onToggleLayer={toggleLayer}
        counts={counts}
      />
    </div>
  );
}

function getBasemapId(): string {
  return getBasemap('satellite')?.id ?? 'satellite';
}

interface LayerContext {
  data: MapData;
  outlines: CountryOutline[];
  radarUrl: string | null;
  aurora: GeoJsonFeatureCollection | null;
  satellites: GeoJsonFeatureCollection | null;
  timezones: GeoJsonFeatureCollection | null;
}

function addLayer(
  map: maplibregl.Map,
  layerId: string,
  { data, outlines, radarUrl, aurora, satellites, timezones }: LayerContext,
): void {
  const definition = getLayer(layerId);
  const opacity = definition?.opacity ?? 1;

  switch (layerId) {
    case 'borders': {
      if (outlines.length === 0) return;
      map.addSource('borders', {
        type: 'geojson',
        data: bordersToGeoJson(outlines) as unknown as GeoJSON.GeoJSON,
      });
      map.addLayer({
        id: 'borders',
        type: 'line',
        source: 'borders',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#7dd3fc', 'line-width': 0.8, 'line-opacity': opacity },
      });
      break;
    }
    case 'graticule': {
      map.addSource('graticule', {
        type: 'geojson',
        data: graticuleToGeoJson() as unknown as GeoJSON.GeoJSON,
      });
      map.addLayer({
        id: 'graticule',
        type: 'line',
        source: 'graticule',
        paint: {
          'line-color': '#64748b',
          'line-width': 0.5,
          'line-opacity': 0.35,
        },
      });
      break;
    }
    case 'day_night': {
      map.addSource('day_night', {
        type: 'geojson',
        data: terminatorToGeoJson(new Date()) as unknown as GeoJSON.GeoJSON,
      });
      const before = map.getLayer('borders') ? 'borders' : undefined;
      map.addLayer(
        {
          id: 'day_night',
          type: 'fill',
          source: 'day_night',
          filter: ['==', ['get', 'fill'], true],
          paint: { 'fill-color': '#0b1220', 'fill-opacity': 0.3 },
        },
        before,
      );
      map.addLayer(
        {
          id: 'day_night-terminator',
          type: 'line',
          source: 'day_night',
          filter: ['==', ['get', 'fill'], false],
          paint: {
            'line-color': '#64748b',
            'line-width': 1,
            'line-opacity': 0.7,
            'line-dasharray': [2, 1.5],
          },
        },
        before,
      );
      break;
    }
    case 'timezones': {
      if (!timezones) return;
      map.addSource('timezones', {
        type: 'geojson',
        data: timezones as unknown as GeoJSON.GeoJSON,
      });
      map.addLayer({
        id: 'timezones',
        type: 'fill',
        source: 'timezones',
        paint: { 'fill-color': '#c4b5fd', 'fill-opacity': opacity * 0.18 },
      });
      map.addLayer({
        id: 'timezones-outline',
        type: 'line',
        source: 'timezones',
        paint: {
          'line-color': '#c4b5fd',
          'line-width': 0.6,
          'line-opacity': opacity,
        },
      });
      break;
    }
    case 'precipitation': {
      if (!radarUrl) return;
      map.addSource('precipitation', {
        type: 'raster',
        tiles: [radarUrl],
        tileSize: 256,
      });
      map.addLayer({
        id: 'precipitation',
        type: 'raster',
        source: 'precipitation',
        paint: { 'raster-opacity': opacity },
      });
      break;
    }
    case 'wind': {
      const config = OM_RASTER_LAYERS.wind;
      if (!config) return;
      map.addSource('wind', {
        type: 'raster',
        url: `om://${config.url}`,
        maxzoom: config.maxzoom,
      });
      map.addLayer({
        id: 'wind',
        type: 'raster',
        source: 'wind',
        paint: { 'raster-opacity': opacity },
      });
      map.addSource(WIND_ARROWS_LAYER_ID, {
        type: 'vector',
        url: `om://${config.url}&arrows=true`,
      });
      map.addLayer({
        id: WIND_ARROWS_LAYER_ID,
        type: 'line',
        source: WIND_ARROWS_LAYER_ID,
        'source-layer': WIND_ARROWS_LAYER_ID,
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': [
            'case',
            ['>', ['to-number', ['get', 'value']], 12],
            'rgba(248,113,113,0.85)',
            ['>', ['to-number', ['get', 'value']], 8],
            'rgba(253,224,71,0.8)',
            'rgba(94,234,212,0.7)',
          ],
          'line-width': 1.6,
        },
      });
      break;
    }
    default: {
      const omConfig = OM_RASTER_LAYERS[layerId];
      if (omConfig) {
        map.addSource(layerId, {
          type: 'raster',
          url: `om://${omConfig.url}`,
          maxzoom: omConfig.maxzoom,
        });
        map.addLayer({
          id: layerId,
          type: 'raster',
          source: layerId,
          paint: { 'raster-opacity': opacity },
        });
        break;
      }
      const gibs = GIBS_RASTER_LAYERS[layerId];
      if (gibs) {
        map.addSource(layerId, {
          type: 'raster',
          tiles: [gibsTileUrl(gibs)],
          tileSize: 256,
          maxzoom: gibs.level,
        });
        map.addLayer({
          id: layerId,
          type: 'raster',
          source: layerId,
          paint: { 'raster-opacity': opacity },
        });
        break;
      }
      const esri = ESRI_RASTER_LAYERS[layerId];
      if (esri) {
        map.addSource(layerId, {
          type: 'raster',
          tiles: [esri.url],
          tileSize: 256,
          maxzoom: esri.maxzoom,
        });
        map.addLayer({
          id: layerId,
          type: 'raster',
          source: layerId,
          paint: { 'raster-opacity': opacity },
        });
        break;
      }
      if (HAZARD_LAYERS.includes(layerId)) {
        map.addSource(layerId, {
          type: 'geojson',
          data: hazardsForLayer(data.hazards, layerId) as unknown as GeoJSON.GeoJSON,
        });
        map.addLayer({
          id: layerId,
          type: 'circle',
          source: layerId,
          paint: {
            'circle-color': ['get', 'color'],
            'circle-radius': ['get', 'radius'],
            'circle-stroke-width': 1,
            'circle-stroke-color': 'rgba(2,6,23,0.6)',
            'circle-opacity': opacity,
          },
        });
      }
      break;
    }
    case 'flights': {
      map.addSource('flights', {
        type: 'geojson',
        data: flightsToGeoJson(data.flights) as unknown as GeoJSON.GeoJSON,
      });
      map.addLayer({
        id: 'flights',
        type: 'circle',
        source: 'flights',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 3,
          'circle-stroke-width': 1,
          'circle-stroke-color': 'rgba(2,6,23,0.55)',
          'circle-opacity': opacity,
        },
      });
      break;
    }
    case 'ships': {
      map.addSource('ships', {
        type: 'geojson',
        data: vesselsToGeoJson(data.vessels) as unknown as GeoJSON.GeoJSON,
      });
      map.addLayer({
        id: 'ships',
        type: 'circle',
        source: 'ships',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 3.5,
          'circle-stroke-width': 1,
          'circle-stroke-color': 'rgba(2,6,23,0.55)',
          'circle-opacity': opacity,
        },
      });
      break;
    }
    case 'iss': {
      map.addSource('iss', {
        type: 'geojson',
        data: issToGeoJson(data.iss) as unknown as GeoJSON.GeoJSON,
      });
      map.addLayer({
        id: 'iss',
        type: 'circle',
        source: 'iss',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 5,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': 'rgba(2,6,23,0.6)',
          'circle-opacity': opacity,
        },
      });
      if (data.issTrack.length > 0) {
        map.addSource('iss-track', {
          type: 'geojson',
          data: issTrackToGeoJson(data.issTrack) as unknown as GeoJSON.GeoJSON,
        });
        map.addLayer({
          id: 'iss-track',
          type: 'line',
          source: 'iss-track',
          paint: {
            'line-color': '#e879f9',
            'line-width': 1.4,
            'line-opacity': 0.55,
            'line-dasharray': [1.5, 1.5],
          },
        });
      }
      break;
    }
    case 'aurora': {
      if (!aurora) return;
      map.addSource('aurora', {
        type: 'geojson',
        data: aurora as unknown as GeoJSON.GeoJSON,
      });
      map.addLayer({
        id: 'aurora',
        type: 'line',
        source: 'aurora',
        paint: {
          'line-color': '#4ade80',
          'line-width': 1.6,
          'line-opacity': 0.8,
          'line-dasharray': [3, 2],
        },
      });
      break;
    }
    case 'satellites': {
      if (!satellites) return;
      map.addSource('satellites', {
        type: 'geojson',
        data: satellites as unknown as GeoJSON.GeoJSON,
      });
      map.addLayer({
        id: 'satellites',
        type: 'circle',
        source: 'satellites',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 3,
          'circle-stroke-width': 1,
          'circle-stroke-color': 'rgba(2,6,23,0.6)',
          'circle-opacity': opacity,
        },
      });
      break;
    }
    case 'airports': {
      map.addSource('airports', {
        type: 'geojson',
        data: airportsToGeoJson(data.airports) as unknown as GeoJSON.GeoJSON,
      });
      map.addLayer({
        id: 'airports',
        type: 'circle',
        source: 'airports',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 4,
          'circle-stroke-width': 1,
          'circle-stroke-color': 'rgba(2,6,23,0.55)',
          'circle-opacity': opacity,
        },
      });
      break;
    }
    case 'seaports': {
      map.addSource('seaports', {
        type: 'geojson',
        data: seaportsToGeoJson(data.seaports) as unknown as GeoJSON.GeoJSON,
      });
      map.addLayer({
        id: 'seaports',
        type: 'circle',
        source: 'seaports',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 4,
          'circle-stroke-width': 1,
          'circle-stroke-color': 'rgba(2,6,23,0.55)',
          'circle-opacity': opacity,
        },
      });
      break;
    }
  }
}

function removeLayer(map: maplibregl.Map, layerId: string): void {
  const related = new Set<string>([layerId, `${layerId}-track`, `${layerId}-terminator`]);
  if (layerId === 'wind') related.add(WIND_ARROWS_LAYER_ID);
  if (layerId === 'timezones') related.add('timezones-outline');
  for (const id of related) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  for (const id of related) {
    if (map.getSource(id)) map.removeSource(id);
  }
}

function popupContent(layerId: string, properties: Record<string, unknown>): string {
  const title =
    (properties.title as string) ??
    (properties.callsign as string) ??
    (properties.name as string) ??
    (properties.code as string) ??
    'Point';

  const rows: [string, string][] = [];
  if (properties.place) rows.push(['Location', String(properties.place)]);
  if (properties.magnitude !== undefined)
    rows.push(['Magnitude', `M ${Number(properties.magnitude).toFixed(1)}`]);
  if (properties.depth !== undefined)
    rows.push(['Depth', `${Number(properties.depth).toFixed(0)} km`]);
  if (properties.severity) rows.push(['Severity', String(properties.severity)]);
  if (properties.kind) rows.push(['Type', String(properties.kind)]);
  if (properties.altitude !== null && properties.altitude !== undefined)
    rows.push(['Altitude', formatDistance(Number(properties.altitude))]);
  if (properties.velocity !== null && properties.velocity !== undefined)
    rows.push(['Speed', formatSpeed(Number(properties.velocity), 'metric')]);
  if (properties.altitudeKm !== undefined)
    rows.push(['Orbit altitude', `${Number(properties.altitudeKm).toLocaleString()} km`]);
  if (properties.heading !== null && properties.heading !== undefined)
    rows.push(['Heading', `${Number(properties.heading).toFixed(0)}°`]);
  if (properties.origin) rows.push(['Origin', String(properties.origin)]);
  if (properties.sog !== null && properties.sog !== undefined)
    rows.push(['Speed', `${Number(properties.sog).toFixed(1)} kn`]);
  if (properties.destination) rows.push(['Destination', String(properties.destination)]);
  if (properties.flag) rows.push(['Flag', String(properties.flag)]);
  if (properties.city) rows.push(['City', String(properties.city)]);
  if (properties.teu !== undefined)
    rows.push(['Throughput', `${Number(properties.teu).toLocaleString()} TEU`]);
  if (properties.source) rows.push(['Source', String(properties.source)]);

  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<div class="mt-1 flex items-baseline justify-between gap-3"><span class="text-muted-foreground text-[10px] uppercase tracking-wide">${label}</span><span class="text-right text-xs font-medium">${value}</span></div>`,
    )
    .join('');

  return `<div class="min-w-44"><p class="text-sm font-semibold leading-snug">${title}</p><div class="mt-2 border-t border-white/10 pt-2">${rowsHtml}</div></div>`;
}
