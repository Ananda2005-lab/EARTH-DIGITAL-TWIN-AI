/**
 * Equirectangular texture for each basemap id in `@edt/shared`'s `BASEMAPS`.
 *
 * `LayerDefinition.urlTemplate` is an XYZ tile template meant for a 2D map
 * (MapLibre); the 3D globe instead wraps one whole-earth image per basemap
 * around the sphere. Three.js's own example asset CDN hosts a well-known,
 * always-available Blue Marble derivative, so most basemaps map to that; night
 * lights uses NASA's Black Marble instead since it needs to actually look dark.
 * Both URLs were verified to resolve with a 200 before being hardcoded here.
 */
const THREE_EXAMPLES = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/textures/planets';
const NASA_VISIBLE_EARTH = 'https://eoimages.gsfc.nasa.gov/images/imagerecords';

const DAY_TEXTURE = `${THREE_EXAMPLES}/earth_atmos_2048.jpg`;
const NIGHT_LIGHTS_TEXTURE = `${THREE_EXAMPLES}/earth_lights_2048.png`;
const TOPO_BATHY_TEXTURE = `${NASA_VISIBLE_EARTH}/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg`;

export const GLOBE_TEXTURES: Record<string, string> = {
  satellite: DAY_TEXTURE,
  hybrid: DAY_TEXTURE,
  street: DAY_TEXTURE,
  light: TOPO_BATHY_TEXTURE,
  dark: DAY_TEXTURE,
  terrain: TOPO_BATHY_TEXTURE,
  ocean: TOPO_BATHY_TEXTURE,
  night_lights: NIGHT_LIGHTS_TEXTURE,
};

export const DEFAULT_GLOBE_TEXTURE = DAY_TEXTURE;

export function textureForBasemap(basemapId: string): string {
  return GLOBE_TEXTURES[basemapId] ?? DEFAULT_GLOBE_TEXTURE;
}
