import * as topojson from 'topojson-client';
import type { Topology } from 'topojson-specification';

import { countryByNumeric } from '@/lib/data/countries';

/** A country's border rendered as one or more closed rings of [lng, lat] pairs. */
export interface CountryOutline {
  /** ISO 3166-1 alpha-2, when the TopoJSON numeric id matches a known country. */
  code: string | null;
  name: string;
  /** One array of [lng, lat] per ring; a multi-polygon country has several. */
  rings: [number, number][][];
}

let cachedCountries: CountryOutline[] | null = null;
let cachedLand: [number, number][][] | null = null;

/**
 * Loads the bundled Natural Earth 110m TopoJSON once per session and converts
 * it to plain ring arrays. The globe re-tessellates rings into 3D line loops on
 * every render of a border layer, so this stays framework-agnostic — no
 * GeoJSON `Feature` wrapper, no Three.js objects, just numbers.
 */
export async function loadCountryOutlines(): Promise<CountryOutline[]> {
  if (cachedCountries) return cachedCountries;

  const response = await fetch('/data/countries-110m.json');
  const topology = (await response.json()) as Topology;
  // The bundled 110m file always defines a `countries` object; the shared
  // `Topology` type just can't express that a specific key is guaranteed.
  const countriesObject = topology.objects.countries!;
  const collection = topojson.feature(topology, countriesObject) as unknown as {
    features: {
      id?: string | number;
      properties?: { name?: string };
      geometry:
        | { type: 'Polygon'; coordinates: [number, number][][] }
        | { type: 'MultiPolygon'; coordinates: [number, number][][][] }
        | null;
    }[];
  };

  cachedCountries = collection.features
    .filter((f) => f.geometry !== null)
    .map((f) => {
      const rings =
        f.geometry!.type === 'Polygon' ? f.geometry!.coordinates : f.geometry!.coordinates.flat();
      const country = f.id !== undefined ? countryByNumeric(f.id) : undefined;
      return {
        code: country?.code ?? null,
        name: country?.name ?? f.properties?.name ?? 'Unknown',
        rings,
      } satisfies CountryOutline;
    });

  return cachedCountries;
}

/** Coarse landmass silhouette (no country subdivisions) for a base fill layer. */
export async function loadLandOutline(): Promise<[number, number][][]> {
  if (cachedLand) return cachedLand;

  const response = await fetch('/data/land-110m.json');
  const topology = (await response.json()) as Topology;
  const landObject = topology.objects.land!;
  const collection = topojson.feature(topology, landObject) as unknown as {
    features: {
      geometry:
        | { type: 'Polygon'; coordinates: [number, number][][] }
        | { type: 'MultiPolygon'; coordinates: [number, number][][][] }
        | null;
    }[];
  };

  cachedLand = collection.features
    .filter((f) => f.geometry !== null)
    .flatMap((f) =>
      f.geometry!.type === 'Polygon' ? f.geometry!.coordinates : f.geometry!.coordinates.flat(),
    );

  return cachedLand;
}
