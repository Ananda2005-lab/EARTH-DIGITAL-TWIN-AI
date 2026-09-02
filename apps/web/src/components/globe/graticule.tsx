'use client';

import * as React from 'react';
import * as THREE from 'three';

import { GLOBE_RADIUS, lngLatToVector3 } from './geo';
import { LAYER_ALTITUDE } from './scales';

const STEP_DEG = 15;
const SEGMENT_DEG = 3;

/**
 * Latitude/longitude grid with tropics-free spacing: meridians every 15° and
 * parallels every 15°. Built once as a single `lineSegments` geometry — two
 * vertices per short arc segment — so it costs one draw call regardless of
 * density.
 */
export function Graticule({ opacity = 0.35 }: { opacity?: number }) {
  const geometry = React.useMemo(() => {
    const positions: number[] = [];
    const radius = GLOBE_RADIUS * LAYER_ALTITUDE.surface;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();

    const push = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
      lngLatToVector3(from, radius, a);
      lngLatToVector3(to, radius, b);
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    };

    // Parallels.
    for (let lat = -75; lat <= 75; lat += STEP_DEG) {
      for (let lng = -180; lng < 180; lng += SEGMENT_DEG) {
        push({ lat, lng }, { lat, lng: lng + SEGMENT_DEG });
      }
    }
    // Meridians.
    for (let lng = -180; lng < 180; lng += STEP_DEG) {
      for (let lat = -90; lat < 90; lat += SEGMENT_DEG) {
        push({ lat, lng }, { lat: lat + SEGMENT_DEG, lng });
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, []);

  React.useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#64748b" transparent opacity={opacity} depthWrite={false} />
    </lineSegments>
  );
}
