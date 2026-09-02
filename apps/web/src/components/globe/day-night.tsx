'use client';

import * as React from 'react';
import * as THREE from 'three';

import { GLOBE_RADIUS, lngLatToVector3 } from './geo';
import { destinationPoint, subsolarPoint } from './navigation';
import { LAYER_ALTITUDE } from './scales';

const TERMINATOR_STEP_DEG = 2;

/**
 * Solar day/night layer: a translucent shell dimming the night hemisphere and
 * a bright line tracing the terminator (the great circle 90° from the subsolar
 * point). Recomputes once a minute — the sun moves 0.25° of longitude in that
 * time, far below the visual threshold.
 */
export function DayNightTerminator() {
  const [subsolar, setSubsolar] = React.useState(() => subsolarPoint(new Date()));

  React.useEffect(() => {
    const timer = window.setInterval(() => setSubsolar(subsolarPoint(new Date())), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const { ringGeometry, shellQuaternion } = React.useMemo(() => {
    const radius = GLOBE_RADIUS * LAYER_ALTITUDE.surface;
    const positions: number[] = [];

    let previous: THREE.Vector3 | null = null;
    for (let bearing = 0; bearing <= 360; bearing += TERMINATOR_STEP_DEG) {
      const point = destinationPoint(subsolar, bearing, 90);
      const vector = lngLatToVector3(point, radius);
      if (previous) positions.push(previous.x, previous.y, previous.z, vector.x, vector.y, vector.z);
      previous = vector;
    }

    const ring = new THREE.BufferGeometry();
    ring.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    // Orient the hemisphere pole (+Y) toward the anti-solar point.
    const antiSolar = lngLatToVector3(
      { lat: -subsolar.lat, lng: ((subsolar.lng + 360) % 360) - 180 },
      1,
    ).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), antiSolar);

    return { ringGeometry: ring, shellQuaternion: quaternion };
  }, [subsolar]);

  React.useEffect(
    () => () => ringGeometry.dispose(),
    [ringGeometry],
  );

  return (
    <group>
      {/* Night-side dimmer: a hemisphere shell facing the camera. */}
      <mesh quaternion={shellQuaternion}>
        <sphereGeometry args={[GLOBE_RADIUS * LAYER_ALTITUDE.shell, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#020617" transparent opacity={0.45} depthWrite={false} />
      </mesh>
      {/* Terminator line. */}
      <lineSegments geometry={ringGeometry}>
        <lineBasicMaterial color="#f8fafc" transparent opacity={0.5} depthWrite={false} />
      </lineSegments>
    </group>
  );
}
