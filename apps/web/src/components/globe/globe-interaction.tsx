'use client';

import { useThree } from '@react-three/fiber';
import type { LngLat } from '@edt/shared';
import * as React from 'react';
import * as THREE from 'three';

import { loadCountryOutlines, type CountryOutline } from './country-geometry';
import { findCountryAt } from './country-picking';
import { GLOBE_RADIUS, vector3ToLngLat } from './geo';

/**
 * Invisible pick sphere plus raycasting, decoupled from the visible
 * `GlobeSphere` so swapping basemap materials never touches hit-testing.
 *
 * On every pointer move this raycasts against the sphere, converts the hit
 * point to lng/lat, and resolves which country (if any) contains it. Hover is
 * throttled implicitly by only recomputing when the resolved country changes,
 * so 60 pointermove events a second do not mean 60 point-in-polygon scans.
 */
export function GlobeInteraction({
  onHoverCountry,
  onSelectCountry,
  onHoverPoint,
}: {
  onHoverCountry?: (country: CountryOutline | null) => void;
  onSelectCountry?: (country: CountryOutline, point: LngLat) => void;
  onHoverPoint?: (point: LngLat | null) => void;
}) {
  const { raycaster, camera, pointer } = useThree();
  const meshRef = React.useRef<THREE.Mesh>(null);
  const outlinesRef = React.useRef<CountryOutline[]>([]);
  const lastCodeRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    loadCountryOutlines()
      .then((loaded) => {
        outlinesRef.current = loaded;
      })
      .catch(() => {
        outlinesRef.current = [];
      });
  }, []);

  const handlePointerMove = React.useCallback(() => {
    if (!meshRef.current) return;
    raycaster.setFromCamera(pointer, camera);
    const [hit] = raycaster.intersectObject(meshRef.current);
    if (!hit) {
      if (lastCodeRef.current !== null) {
        lastCodeRef.current = null;
        onHoverCountry?.(null);
      }
      onHoverPoint?.(null);
      return;
    }

    const point = vector3ToLngLat(hit.point);
    onHoverPoint?.(point);
    const resolved = findCountryAt(outlinesRef.current, point.lng, point.lat);
    const code = resolved?.code ?? resolved?.name ?? null;
    if (code !== lastCodeRef.current) {
      lastCodeRef.current = code;
      onHoverCountry?.(resolved);
    }
  }, [camera, onHoverCountry, onHoverPoint, pointer, raycaster]);

  const handleClick = React.useCallback(() => {
    if (!meshRef.current) return;
    raycaster.setFromCamera(pointer, camera);
    const [hit] = raycaster.intersectObject(meshRef.current);
    if (!hit) return;
    const point = vector3ToLngLat(hit.point);
    const resolved = findCountryAt(outlinesRef.current, point.lng, point.lat);
    if (resolved) onSelectCountry?.(resolved, point);
  }, [camera, onSelectCountry, pointer, raycaster]);

  return (
    <mesh
      ref={meshRef}
      onPointerMove={handlePointerMove}
      onClick={handleClick}
      onPointerLeave={() => {
        lastCodeRef.current = null;
        onHoverCountry?.(null);
        onHoverPoint?.(null);
      }}
    >
      <sphereGeometry args={[GLOBE_RADIUS, 48, 48]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}
