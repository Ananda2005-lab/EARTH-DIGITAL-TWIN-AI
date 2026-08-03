'use client';

import * as React from 'react';
import * as THREE from 'three';

import { GLOBE_RADIUS } from './geo';

/**
 * The base planet: a lit sphere textured with the active basemap plus a thin
 * additive-blended shell for the atmosphere glow. Both live in one component
 * because the atmosphere's radius is derived from the sphere's, and keeping
 * them coupled avoids a second source of truth for `GLOBE_RADIUS`.
 */
export function GlobeSphere({ textureUrl }: { textureUrl: string }) {
  const texture = useSafeTexture(textureUrl);

  return (
    <group>
      <mesh renderOrder={0}>
        <sphereGeometry args={[GLOBE_RADIUS, 96, 96]} />
        {texture ? (
          <meshStandardMaterial map={texture} roughness={0.95} metalness={0} />
        ) : (
          <meshStandardMaterial color="#0b1a2e" roughness={1} />
        )}
      </mesh>

      {/* Backface-rendered shell lit from inside-out reads as a limb glow. */}
      <mesh scale={1.015} renderOrder={1}>
        <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.12}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/**
 * Loads a texture without throwing the whole scene into React Three Fiber's
 * `useTexture` suspense boundary. Basemap swaps should cross-fade, not unmount
 * the canvas, so failures and in-flight loads both just fall back to the plain
 * material above instead of suspending.
 */
function useSafeTexture(url: string): THREE.Texture | null {
  const [texture, setTexture] = React.useState<THREE.Texture | null>(null);

  React.useEffect(() => {
    let disposed = false;
    let loadedTexture: THREE.Texture | null = null;
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (loaded) => {
        if (disposed) {
          loaded.dispose();
          return;
        }
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.anisotropy = 4;
        loadedTexture = loaded;
        setTexture(loaded);
      },
      undefined,
      () => {
        if (!disposed) setTexture(null);
      },
    );
    return () => {
      disposed = true;
      // Dispose the previous basemap's GPU texture once a new one loads.
      loadedTexture?.dispose();
    };
  }, [url]);

  return texture;
}
