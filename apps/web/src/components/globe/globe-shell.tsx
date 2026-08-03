'use client';

import { BASEMAPS, DEFAULT_BASEMAP, type HazardEvent, type LngLat } from '@edt/shared';
import dynamic from 'next/dynamic';
import * as React from 'react';

import type { CountryOutline } from './country-geometry';
import type { FlyToTarget } from './globe-camera';
import { textureForBasemap } from './basemap-textures';
import { GlobeHud } from './globe-hud';

const GlobeScene = dynamic(() => import('./globe-scene').then((mod) => mod.GlobeScene), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-[#03060f]">
      <div className="text-muted-foreground flex flex-col items-center gap-3 text-sm">
        <span className="border-primary size-8 animate-spin rounded-full border-2 border-t-transparent" />
        Loading the globe…
      </div>
    </div>
  ),
});

/**
 * Client-only shell around the WebGL scene.
 *
 * Everything stateful — the selected basemap, which country is hovered,
 * where the camera should fly to — lives here rather than in the scene, so
 * the HUD (a plain DOM overlay) and the Canvas share state without either one
 * reaching into the other's internals.
 */
export function GlobeShell({ initialHazards }: { initialHazards: HazardEvent[] }) {
  const [basemap, setBasemap] = React.useState(DEFAULT_BASEMAP);
  const [hazards] = React.useState(initialHazards);
  const [hoveredCountry, setHoveredCountry] = React.useState<CountryOutline | null>(null);
  const [selectedCountry, setSelectedCountry] = React.useState<CountryOutline | null>(null);
  const [selectedHazard, setSelectedHazard] = React.useState<HazardEvent | null>(null);
  const [flyTo, setFlyTo] = React.useState<FlyToTarget | null>(null);
  const [autoRotate, setAutoRotate] = React.useState(true);
  const nonceRef = React.useRef(0);

  const flyToPoint = React.useCallback((center: LngLat, distance?: number) => {
    nonceRef.current += 1;
    setAutoRotate(false);
    setFlyTo({ center, distance, nonce: nonceRef.current });
  }, []);

  const handleSelectCountry = React.useCallback(
    (country: CountryOutline, point: LngLat) => {
      setSelectedCountry(country);
      setSelectedHazard(null);
      flyToPoint(point, 175);
    },
    [flyToPoint],
  );

  const handleSelectHazard = React.useCallback(
    (event: HazardEvent) => {
      setSelectedHazard(event);
      setSelectedCountry(null);
      flyToPoint(event.location, 160);
    },
    [flyToPoint],
  );

  return (
    <div className="map-shell">
      <GlobeScene
        basemapUrl={textureForBasemap(basemap)}
        hazards={hazards}
        flyTo={flyTo}
        autoRotate={autoRotate}
        onHoverCountry={setHoveredCountry}
        onSelectCountry={handleSelectCountry}
        onSelectHazard={handleSelectHazard}
        onUserInteracted={() => setAutoRotate(false)}
      />

      <div className="globe-vignette pointer-events-none absolute inset-0" aria-hidden />

      <GlobeHud
        basemap={basemap}
        onBasemapChange={setBasemap}
        basemaps={BASEMAPS}
        hoveredCountry={hoveredCountry}
        selectedCountry={selectedCountry}
        selectedHazard={selectedHazard}
        hazardCount={hazards.length}
        autoRotate={autoRotate}
        onToggleAutoRotate={() => setAutoRotate((value) => !value)}
        onFlyTo={flyToPoint}
        onCloseInfo={() => {
          setSelectedCountry(null);
          setSelectedHazard(null);
        }}
      />
    </div>
  );
}
