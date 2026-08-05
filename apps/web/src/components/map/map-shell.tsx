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
  flightsToGeoJson,
  hazardsForLayer,
  issToGeoJson,
  issTrackToGeoJson,
  layerCounts,
  resolveRadarTileTemplate,
  seaportsToGeoJson,
  SUPPORTED_DATA_LAYERS,
  vesselsToGeoJson,
  type MapData,
} from './map-data';

const HAZARD_LAYERS = ['earthquakes', 'wildfires', 'volcanoes', 'floods', 'cyclones'];

/** Layers rendered as clickable circles. */
const POINT_LAYERS = [...HAZARD_LAYERS, 'flights', 'ships', 'iss', 'airports', 'seaports'];

const DEFAULT_ENABLED = new Set<string>(['borders', 'earthquakes']);

export function MapShell({ data }: { data: MapData }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<maplibregl.Map | null>(null);
  const [basemap, setBasemap] = React.useState<string>(() => getBasemapId());
  const [enabled, setEnabled] = React.useState<Set<string>>(DEFAULT_ENABLED);
  const [outlines, setOutlines] = React.useState<CountryOutline[]>([]);
  const [radarUrl, setRadarUrl] = React.useState<string | null>(null);

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

  // Synchronise sources and layers with the enabled set.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const layerId of SUPPORTED_DATA_LAYERS) {
      const shouldShow = enabled.has(layerId);
      const exists = map.getSource(layerId) !== undefined;
      if (shouldShow && !exists) addLayer(map, layerId, { data, outlines, radarUrl });
      if (!shouldShow && exists) removeLayer(map, layerId);
    }
  }, [enabled, outlines, radarUrl, data]);

  return (
    <div className="map-shell">
      <div ref={containerRef} className="absolute inset-0" />

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
}

function addLayer(
  map: maplibregl.Map,
  layerId: string,
  { data, outlines, radarUrl }: LayerContext,
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
    default: {
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
  }
}

function removeLayer(map: maplibregl.Map, layerId: string): void {
  if (map.getLayer(`${layerId}-track`)) map.removeLayer(`${layerId}-track`);
  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(`${layerId}-track`)) map.removeSource(`${layerId}-track`);
  if (map.getSource(layerId)) map.removeSource(layerId);
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
