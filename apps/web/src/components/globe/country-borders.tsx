'use client';

import * as React from 'react';
import * as THREE from 'three';

import { loadCountryOutlines, type CountryOutline } from './country-geometry';
import { GLOBE_RADIUS, lngLatToVector3 } from './geo';

/** Slightly proud of the sphere surface so lines never z-fight with the basemap. */
const LINE_RADIUS = GLOBE_RADIUS * 1.001;

/**
 * All 177 country outlines as a single `LineSegments` mesh.
 *
 * One draw call for every border in the world, rather than one `<Line>` per
 * country, is the difference between this costing nothing and costing 177
 * separate geometries — draw-call count matters far more than vertex count for
 * a scene that also has to hold weather particles and live vehicle markers.
 *
 * Country picking (hover/click) is handled separately by raycasting against
 * the base sphere and running a point-in-polygon test — see
 * `country-picking.ts` — rather than picking on these line segments, which
 * would miss clicks anywhere inside a country's interior.
 */
export function CountryBorders() {
  const [outlines, setOutlines] = React.useState<CountryOutline[] | null>(null);

  React.useEffect(() => {
    let active = true;
    loadCountryOutlines()
      .then((loaded) => {
        if (active) setOutlines(loaded);
      })
      .catch(() => {
        if (active) setOutlines([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const geometry = React.useMemo(() => {
    if (!outlines) return null;
    const positions: number[] = [];
    const vector = new THREE.Vector3();

    for (const outline of outlines) {
      for (const ring of outline.rings) {
        for (let i = 0; i < ring.length; i += 1) {
          const [lng, lat] = ring[i]!;
          lngLatToVector3({ lng, lat }, LINE_RADIUS, vector);
          positions.push(vector.x, vector.y, vector.z);
          // Push each interior vertex twice so consecutive pairs form segments
          // (A,B),(B,C),(C,D)... without duplicating the geometry per pair.
          if (i > 0 && i < ring.length - 1) positions.push(vector.x, vector.y, vector.z);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [outlines]);

  React.useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!geometry) return null;

  return (
    <lineSegments geometry={geometry} renderOrder={2}>
      <lineBasicMaterial color="#7dd3fc" transparent opacity={0.55} depthWrite={false} />
    </lineSegments>
  );
}
