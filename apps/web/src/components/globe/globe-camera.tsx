'use client';

import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import type { LngLat } from '@edt/shared';
import * as React from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

import { GLOBE_RADIUS, lngLatToVector3 } from './geo';

export interface FlyToTarget {
  center: LngLat;
  /** Camera distance from the globe centre; smaller zooms in. Default keeps the current distance. */
  distance?: number;
  /** Monotonically increasing so the same coordinate can be re-triggered (e.g. clicking the same country twice). */
  nonce: number;
}

/**
 * Orbit controls plus an imperative fly-to animation and idle auto-rotate.
 *
 * The fly-to interpolates the camera's spherical position (not just `lookAt`)
 * so the globe itself never moves — only the viewpoint does, which keeps every
 * other layer's world-space coordinates valid throughout the animation.
 */
export function GlobeCamera({
  flyTo,
  autoRotate,
  onUserInteracted,
}: {
  flyTo?: FlyToTarget | null;
  autoRotate: boolean;
  onUserInteracted?: () => void;
}) {
  const { camera } = useThree();
  const controlsRef = React.useRef<OrbitControlsImpl>(null);
  const animationRef = React.useRef<{
    from: THREE.Vector3;
    to: THREE.Vector3;
    startedAt: number;
    durationMs: number;
  } | null>(null);
  const lastNonceRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!flyTo || flyTo.nonce === lastNonceRef.current) return;
    lastNonceRef.current = flyTo.nonce;

    const currentDistance = camera.position.length();
    const distance = flyTo.distance ?? Math.max(160, currentDistance);
    const to = lngLatToVector3(flyTo.center, distance);

    animationRef.current = {
      from: camera.position.clone(),
      to,
      startedAt: performance.now(),
      // Longer trips (near-antipodal) get proportionally more time so the
      // angular speed stays roughly constant instead of a fixed-duration snap.
      durationMs: 900 + Math.min(900, camera.position.angleTo(to) * 500),
    };
  }, [camera, flyTo]);

  useFrame((_, delta) => {
    const animation = animationRef.current;
    if (animation) {
      const elapsed = performance.now() - animation.startedAt;
      const t = Math.min(1, elapsed / animation.durationMs);
      const eased = easeInOutCubic(t);
      camera.position.copy(animation.from).lerp(animation.to, eased);
      camera.lookAt(0, 0, 0);
      if (t >= 1) animationRef.current = null;
    } else if (autoRotate) {
      camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), delta * 0.03);
      camera.lookAt(0, 0, 0);
    }
    controlsRef.current?.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      minDistance={GLOBE_RADIUS * 1.08}
      maxDistance={GLOBE_RADIUS * 6}
      rotateSpeed={0.4}
      zoomSpeed={0.6}
      enableDamping
      dampingFactor={0.08}
      onStart={onUserInteracted}
    />
  );
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
