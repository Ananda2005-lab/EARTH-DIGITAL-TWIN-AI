'use client';

import { getBasemap, type LngLat } from '@edt/shared';
import { Maximize2 } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Link from 'next/link';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Compact, non-interactive MapLibre preview used on country / city detail
 * pages. It renders the same shared basemap catalogue as the full 2D map and
 * drops a marker on the given coordinate, with a link through to `/map` — so
 * every detail page is one click away from the full mission view.
 */
export function MapEmbed({
  center,
  zoom = 4,
  basemapId = 'satellite',
  label,
  className,
  href = '/map',
}: {
  center: LngLat;
  zoom?: number;
  basemapId?: string;
  /** Optional text label shown in the bottom-left corner. */
  label?: string;
  className?: string;
  /** Where "Open in map" points; defaults to the full 2D map. */
  href?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<maplibregl.Map | null>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const basemap = getBasemap(basemapId) ?? getBasemap('satellite')!;
    const map = new maplibregl.Map({
      container,
      style: {
        version: 8,
        sources: {
          basemap: {
            type: 'raster',
            tiles: [basemap.urlTemplate],
            tileSize: 256,
            maxzoom: basemap.maxZoom,
            attribution: basemap.attribution,
          },
        },
        layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
      },
      center: [center.lng, center.lat],
      zoom,
      attributionControl: { compact: true },
      interactive: false,
    });

    new maplibregl.Marker({ color: '#38bdf8' }).setLngLat([center.lng, center.lat]).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [center.lng, center.lat, zoom, basemapId]);

  return (
    <div className={cn('relative overflow-hidden rounded-2xl', className)}>
      <div ref={containerRef} className="absolute inset-0" aria-hidden />
      {label ? (
        <span className="glass-sm pointer-events-none absolute bottom-3 left-3 rounded-lg px-2.5 py-1 text-xs font-medium">
          {label}
        </span>
      ) : null}
      <Link
        href={href}
        className="glass-sm focus-visible:ring-ring absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2"
      >
        <Maximize2 className="size-3.5" aria-hidden />
        Open in map
      </Link>
    </div>
  );
}
