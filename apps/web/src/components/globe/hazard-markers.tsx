'use client';

import type { HazardEvent, HazardSeverity } from '@edt/shared';
import { Billboard, Html } from '@react-three/drei';
import * as React from 'react';

import { GLOBE_RADIUS, lngLatToVector3 } from './geo';

const SEVERITY_COLOR: Record<HazardSeverity, string> = {
  info: '#94a3b8',
  low: '#38bdf8',
  moderate: '#facc15',
  high: '#fb923c',
  extreme: '#ef4444',
};

const SEVERITY_SIZE: Record<HazardSeverity, number> = {
  info: 1.2,
  low: 1.4,
  moderate: 1.8,
  high: 2.3,
  extreme: 3,
};

/**
 * Hazard events as billboarded pulsing dots.
 *
 * `Billboard` keeps each marker facing the camera regardless of globe
 * rotation — a plain mesh would foreshorten into an ellipse near the limb.
 * Markers render above the surface (`* 1.01`) so they never clip into terrain
 * or the border line layer.
 */
export function HazardMarkers({
  events,
  onSelect,
}: {
  events: HazardEvent[];
  onSelect?: (event: HazardEvent) => void;
}) {
  // The fused feed can still contain duplicate ids (e.g. the same GDACS event
  // returned twice across paginated upstream responses); de-duplicate here
  // rather than trusting every upstream provider's id to be unique.
  const uniqueEvents = React.useMemo(() => {
    const seen = new Set<string>();
    return events.filter((event) => {
      if (seen.has(event.id)) return false;
      seen.add(event.id);
      return true;
    });
  }, [events]);

  return (
    <group>
      {uniqueEvents.map((event) => (
        <HazardMarker key={event.id} event={event} onSelect={onSelect} />
      ))}
    </group>
  );
}

function HazardMarker({
  event,
  onSelect,
}: {
  event: HazardEvent;
  onSelect?: (event: HazardEvent) => void;
}) {
  const position = React.useMemo(
    () => lngLatToVector3(event.location, GLOBE_RADIUS * 1.01),
    [event.location],
  );
  const color = SEVERITY_COLOR[event.severity];
  const size = SEVERITY_SIZE[event.severity];
  const [hovered, setHovered] = React.useState(false);

  return (
    <Billboard position={position}>
      <mesh
        onClick={(domEvent) => {
          domEvent.stopPropagation();
          onSelect?.(event);
        }}
        onPointerOver={(domEvent) => {
          domEvent.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <circleGeometry args={[hovered ? size * 1.4 : size, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} depthWrite={false} />
      </mesh>
      {event.severity === 'extreme' ? (
        <mesh>
          <ringGeometry args={[size * 1.3, size * 1.8, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ) : null}
      {hovered ? (
        <Html center distanceFactor={140} zIndexRange={[10, 0]}>
          <div className="glass pointer-events-none whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs">
            <p className="font-medium">{event.title}</p>
            <p className="text-muted-foreground">{event.place ?? event.kind}</p>
          </div>
        </Html>
      ) : null}
    </Billboard>
  );
}
