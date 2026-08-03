'use client';

import { Stars } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import type { HazardEvent, LngLat } from '@edt/shared';
import * as React from 'react';

import { CountryBorders } from './country-borders';
import type { CountryOutline } from './country-geometry';
import { GlobeCamera, type FlyToTarget } from './globe-camera';
import { GlobeInteraction } from './globe-interaction';
import { GlobeSphere } from './globe-sphere';
import { HazardMarkers } from './hazard-markers';

export interface GlobeSceneProps {
  basemapUrl: string;
  hazards: HazardEvent[];
  flyTo: FlyToTarget | null;
  autoRotate: boolean;
  onHoverCountry?: (country: CountryOutline | null) => void;
  onSelectCountry?: (country: CountryOutline, point: LngLat) => void;
  onSelectHazard?: (event: HazardEvent) => void;
  onUserInteracted?: () => void;
}

/**
 * The Three.js scene, isolated in its own component so the WebGL canvas is
 * the only thing `dynamic(() => import(...), { ssr: false })` has to defer —
 * `globe-shell.tsx` owns everything that must render on the server (page
 * chrome, the layer panel) and lazy-loads this.
 */
export function GlobeScene({
  basemapUrl,
  hazards,
  flyTo,
  autoRotate,
  onHoverCountry,
  onSelectCountry,
  onSelectHazard,
  onUserInteracted,
}: GlobeSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 260], fov: 45, near: 1, far: 4000 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#03060f']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[220, 140, 180]} intensity={1.4} />
      <Stars radius={800} depth={80} count={4000} factor={3} saturation={0} fade speed={0.4} />

      <GlobeSphere textureUrl={basemapUrl} />
      <CountryBorders />
      <HazardMarkers events={hazards} onSelect={onSelectHazard} />
      <GlobeInteraction onHoverCountry={onHoverCountry} onSelectCountry={onSelectCountry} />
      <GlobeCamera flyTo={flyTo} autoRotate={autoRotate} onUserInteracted={onUserInteracted} />
    </Canvas>
  );
}
