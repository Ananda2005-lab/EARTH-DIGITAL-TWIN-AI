'use client';

import type { LngLat } from '@edt/shared';
import { Billboard, Html } from '@react-three/drei';
import * as React from 'react';

import { api } from '@/lib/api/client';

import { GLOBE_RADIUS, lngLatToVector3 } from './geo';
import { LAYER_ALTITUDE } from './scales';

/**
 * Generic live point layer: polls an API endpoint and renders the contained
 * positions as billboarded dots in the layer's accent colour.
 *
 * Feed envelopes differ per endpoint (`{ flights }`, `{ vessels }`, a plain
 * list, or a single object for the ISS), so instead of one fetcher per layer
 * we scan the payload for anything carrying a position. Capped so a huge feed
 * can never wedge the render loop.
 */

export interface GlobePoint {
  id: string;
  position: LngLat;
  label?: string;
}

interface LiveSource {
  path: string;
  /** Polling floor in seconds; the catalogue's refreshSeconds is honoured above it. */
  minSeconds: number;
  size: number;
}

export const LIVE_SOURCES: Record<string, LiveSource> = {
  flights: { path: '/flights', minSeconds: 15, size: 1.1 },
  ships: { path: '/ships', minSeconds: 30, size: 1.1 },
  airports: { path: '/flights/airports', minSeconds: 3600, size: 1.4 },
  seaports: { path: '/ships/seaports', minSeconds: 3600, size: 1.4 },
  satellites: { path: '/space/satellites', minSeconds: 60, size: 0.9 },
  iss: { path: '/space/iss', minSeconds: 10, size: 2.2 },
};

const MAX_POINTS = 600;

function looksLikeLngLat(value: unknown): value is LngLat {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as LngLat).lat === 'number' &&
    typeof (value as LngLat).lng === 'number'
  );
}

/** Recursively collect position-bearing records from any feed shape. */
export function extractPoints(payload: unknown, out: GlobePoint[] = []): GlobePoint[] {
  if (out.length >= MAX_POINTS) return out;

  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (out.length >= MAX_POINTS) break;
      extractPoints(item, out);
    }
    return out;
  }

  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>;
    if (looksLikeLngLat(record.position)) {
      const id =
        (['icao24', 'mmsi', 'id', 'code', 'icao', 'iata', 'name']
          .map((key) => record[key])
          .find((value) => typeof value === 'string') as string | undefined) ??
        String(out.length);
      const label =
        (['callsign', 'name', 'label', 'title']
          .map((key) => record[key])
          .find((value) => typeof value === 'string' && value.length > 0) as string | undefined) ??
        undefined;
      out.push({ id, position: record.position as LngLat, label });
      return out;
    }
    // Direct lat/lng fields (some space feeds).
    if (typeof record.lat === 'number' && typeof record.lng === 'number') {
      out.push({ id: String(out.length), position: { lat: record.lat, lng: record.lng } });
      return out;
    }
    for (const value of Object.values(record)) {
      if (out.length >= MAX_POINTS) break;
      extractPoints(value, out);
    }
  }

  return out;
}

export function DataPointsLayer({
  layerId,
  color,
}: {
  layerId: string;
  color: string;
}) {
  const source = LIVE_SOURCES[layerId];
  const [points, setPoints] = React.useState<GlobePoint[]>([]);

  React.useEffect(() => {
    if (!source) return;
    let active = true;

    const load = async () => {
      try {
        const payload = await api<unknown>(source.path);
        if (active) setPoints(extractPoints(payload));
      } catch {
        // Provider down or key missing — keep whatever we last had.
      }
    };

    void load();
    const timer = window.setInterval(load, Math.max(source.minSeconds, 15) * 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [source]);

  if (!source) return null;

  return (
    <group>
      {points.map((point) => (
        <PointMarker
          key={`${point.id}-${point.position.lat.toFixed(3)}-${point.position.lng.toFixed(3)}`}
          point={point}
          color={color}
          size={source.size}
        />
      ))}
    </group>
  );
}

function PointMarker({ point, color, size }: { point: GlobePoint; color: string; size: number }) {
  const position = React.useMemo(
    () => lngLatToVector3(point.position, GLOBE_RADIUS * LAYER_ALTITUDE.markers),
    [point.position],
  );
  const [hovered, setHovered] = React.useState(false);

  return (
    <Billboard position={position}>
      <mesh
        onPointerOver={(domEvent) => {
          domEvent.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <circleGeometry args={[hovered ? size * 1.5 : size, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} depthWrite={false} />
      </mesh>
      {hovered && point.label ? (
        <Html center distanceFactor={140} zIndexRange={[10, 0]}>
          <div className="glass pointer-events-none whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs">
            {point.label}
          </div>
        </Html>
      ) : null}
    </Billboard>
  );
}
