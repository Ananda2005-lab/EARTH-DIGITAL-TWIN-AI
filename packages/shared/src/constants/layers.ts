/**
 * Canonical catalogue of basemaps and data layers.
 * The web client renders its layer manager straight from this registry, and the
 * API validates layer ids against it, so both stay in lockstep.
 */

export type LayerCategory =
  | 'base'
  | 'reference'
  | 'weather'
  | 'environment'
  | 'hazard'
  | 'ocean'
  | 'society'
  | 'infrastructure'
  | 'transport'
  | 'space';

export type LayerRenderKind = 'raster' | 'vector' | 'points' | 'heatmap' | 'particles' | 'model';

export interface BasemapDefinition {
  id: string;
  label: string;
  description: string;
  /** XYZ template. `{s}` is an optional subdomain token. */
  urlTemplate: string;
  attribution: string;
  maxZoom: number;
  /** Suitable for dark UI without inversion. */
  dark: boolean;
  requiresKey?: string;
}

export const BASEMAPS: readonly BasemapDefinition[] = [
  {
    id: 'satellite',
    label: 'Satellite',
    description: 'True-colour imagery mosaic with global coverage down to sub-metre in cities.',
    urlTemplate:
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
    dark: true,
  },
  {
    id: 'hybrid',
    label: 'Hybrid',
    description: 'Satellite imagery with roads, boundaries and place labels overlaid.',
    urlTemplate:
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri, Maxar, OpenStreetMap contributors',
    maxZoom: 19,
    dark: true,
  },
  {
    id: 'terrain',
    label: 'Terrain',
    description: 'Shaded relief with hypsometric tints, contour-aware hillshading.',
    urlTemplate: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'OpenTopoMap, SRTM, OpenStreetMap contributors',
    maxZoom: 17,
    dark: false,
  },
  {
    id: 'street',
    label: 'Street',
    description: 'Detailed street network, transit lines, POIs and address points.',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: 'OpenStreetMap contributors',
    maxZoom: 19,
    dark: false,
  },
  {
    id: 'dark',
    label: 'Midnight',
    description: 'Low-luminance cartography tuned for data overlays and mission control.',
    urlTemplate: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: 'CARTO, OpenStreetMap contributors',
    maxZoom: 19,
    dark: true,
  },
  {
    id: 'light',
    label: 'Daylight',
    description: 'High-contrast light cartography for print-ready exports.',
    urlTemplate: 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: 'CARTO, OpenStreetMap contributors',
    maxZoom: 19,
    dark: false,
  },
  {
    id: 'night_lights',
    label: 'Night Lights',
    description: 'VIIRS day/night band composite showing human settlement luminosity.',
    urlTemplate:
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',
    attribution: 'NASA GIBS, Black Marble',
    maxZoom: 8,
    dark: true,
  },
  {
    id: 'ocean',
    label: 'Ocean Floor',
    description: 'GEBCO bathymetry with seafloor features and trench labelling.',
    urlTemplate:
      'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri, GEBCO, NOAA',
    maxZoom: 13,
    dark: true,
  },
] as const;

export const DEFAULT_BASEMAP = 'satellite';

export interface LayerDefinition {
  id: string;
  label: string;
  category: LayerCategory;
  description: string;
  render: LayerRenderKind;
  /** Colour used for the legend swatch and globe styling. */
  accent: string;
  /** Default opacity 0..1. */
  opacity: number;
  /** Layers with a higher order draw on top. */
  order: number;
  attribution: string;
  /** Seconds a client may cache the layer payload. */
  refreshSeconds: number;
  /** Requires an authenticated pro/team plan. */
  premium?: boolean;
  /** Requires an operator-provided API key; the UI shows a setup hint instead of failing. */
  requiresKey?: string;
  legend?: LayerLegend;
  urlTemplate?: string;
}

export interface LayerLegend {
  kind: 'ramp' | 'categories';
  unit?: string;
  stops: { value: number | string; label: string; color: string }[];
}

export const LAYERS: readonly LayerDefinition[] = [
  // ── Reference ────────────────────────────────────────────────────────────────
  {
    id: 'borders',
    label: 'Political Borders',
    category: 'reference',
    description: 'Sovereign boundaries, disputed lines and maritime EEZ edges.',
    render: 'vector',
    accent: '#7dd3fc',
    opacity: 0.85,
    order: 60,
    attribution: 'Natural Earth',
    refreshSeconds: 86_400,
  },
  {
    id: 'labels',
    label: 'Place Labels',
    category: 'reference',
    description: 'Country, city and physical feature labels with collision-aware placement.',
    render: 'vector',
    accent: '#e2e8f0',
    opacity: 1,
    order: 90,
    attribution: 'Natural Earth, GeoNames',
    refreshSeconds: 86_400,
  },
  {
    id: 'graticule',
    label: 'Graticule',
    category: 'reference',
    description: 'Latitude and longitude grid with tropics and polar circles.',
    render: 'vector',
    accent: '#475569',
    opacity: 0.4,
    order: 55,
    attribution: 'Earth Digital Twin',
    refreshSeconds: 86_400,
  },
  {
    id: 'timezones',
    label: 'Time Zones',
    category: 'reference',
    description: 'IANA time zone polygons with live UTC offsets and DST state.',
    render: 'vector',
    accent: '#c4b5fd',
    opacity: 0.5,
    order: 58,
    attribution: 'Evan Siroky timezone-boundary-builder',
    refreshSeconds: 3_600,
  },
  {
    id: 'terrain_mesh',
    label: 'Terrain Elevation',
    category: 'reference',
    description: 'Exaggerated 3D relief driven by Copernicus DEM tiles.',
    render: 'model',
    accent: '#a3a380',
    opacity: 1,
    order: 10,
    attribution: 'Copernicus DEM, SRTM',
    refreshSeconds: 86_400,
  },

  // ── Weather ─────────────────────────────────────────────────────────────────
  {
    id: 'temperature',
    label: 'Temperature',
    category: 'weather',
    description: '2 m air temperature field from the ECMWF/GFS blend.',
    render: 'heatmap',
    accent: '#fb923c',
    opacity: 0.7,
    order: 30,
    attribution: 'Open-Meteo, ECMWF, NOAA GFS',
    refreshSeconds: 900,
    legend: {
      kind: 'ramp',
      unit: '°C',
      stops: [
        { value: -40, label: '-40', color: '#4c1d95' },
        { value: -20, label: '-20', color: '#2563eb' },
        { value: 0, label: '0', color: '#22d3ee' },
        { value: 15, label: '15', color: '#4ade80' },
        { value: 25, label: '25', color: '#facc15' },
        { value: 35, label: '35', color: '#f97316' },
        { value: 45, label: '45+', color: '#dc2626' },
      ],
    },
  },
  {
    id: 'precipitation',
    label: 'Rain & Snow',
    category: 'weather',
    description: 'Radar-calibrated precipitation rate with snow/rain phase shading.',
    render: 'raster',
    accent: '#38bdf8',
    opacity: 0.75,
    order: 32,
    attribution: 'RainViewer, Open-Meteo',
    refreshSeconds: 300,
    urlTemplate: 'https://tilecache.rainviewer.com/v2/radar/{ts}/256/{z}/{x}/{y}/2/1_1.png',
    legend: {
      kind: 'ramp',
      unit: 'mm/h',
      stops: [
        { value: 0.1, label: 'Trace', color: '#bae6fd' },
        { value: 1, label: 'Light', color: '#38bdf8' },
        { value: 4, label: 'Moderate', color: '#2563eb' },
        { value: 10, label: 'Heavy', color: '#7c3aed' },
        { value: 30, label: 'Violent', color: '#db2777' },
      ],
    },
  },
  {
    id: 'wind',
    label: 'Wind',
    category: 'weather',
    description: 'Animated 10 m wind particles with gust magnitude colouring.',
    render: 'particles',
    accent: '#5eead4',
    opacity: 0.9,
    order: 34,
    attribution: 'Open-Meteo, NOAA GFS',
    refreshSeconds: 900,
    legend: {
      kind: 'ramp',
      unit: 'km/h',
      stops: [
        { value: 0, label: 'Calm', color: '#0f766e' },
        { value: 20, label: 'Breeze', color: '#14b8a6' },
        { value: 40, label: 'Strong', color: '#5eead4' },
        { value: 70, label: 'Gale', color: '#fde047' },
        { value: 120, label: 'Hurricane', color: '#ef4444' },
      ],
    },
  },
  {
    id: 'clouds',
    label: 'Clouds',
    category: 'weather',
    description: 'Near-real-time geostationary infrared cloud composite.',
    render: 'raster',
    accent: '#e5e7eb',
    opacity: 0.6,
    order: 31,
    attribution: 'NASA GIBS, GOES / Meteosat / Himawari',
    refreshSeconds: 600,
  },
  {
    id: 'pressure',
    label: 'Pressure',
    category: 'weather',
    description: 'Mean sea-level pressure isobars with cyclone/anticyclone centres.',
    render: 'vector',
    accent: '#93c5fd',
    opacity: 0.7,
    order: 33,
    attribution: 'Open-Meteo, ECMWF',
    refreshSeconds: 1_800,
  },
  {
    id: 'lightning',
    label: 'Lightning',
    category: 'weather',
    description: 'Global sferics network strike detections from the last 30 minutes.',
    render: 'points',
    accent: '#fef08a',
    opacity: 1,
    order: 40,
    attribution: 'Blitzortung community network',
    refreshSeconds: 120,
    premium: true,
  },
  {
    id: 'snow_cover',
    label: 'Snow Cover',
    category: 'weather',
    description: 'MODIS daily snow extent and estimated snow depth.',
    render: 'raster',
    accent: '#f8fafc',
    opacity: 0.7,
    order: 29,
    attribution: 'NASA MODIS',
    refreshSeconds: 21_600,
  },

  // ── Environment ─────────────────────────────────────────────────────────────
  {
    id: 'air_quality',
    label: 'Air Quality',
    category: 'environment',
    description: 'CAMS PM2.5 surface concentration mapped to the US EPA AQI scale.',
    render: 'heatmap',
    accent: '#f472b6',
    opacity: 0.65,
    order: 36,
    attribution: 'Copernicus CAMS, Open-Meteo',
    refreshSeconds: 1_800,
    legend: {
      kind: 'ramp',
      unit: 'AQI',
      stops: [
        { value: 50, label: 'Good', color: '#22c55e' },
        { value: 100, label: 'Moderate', color: '#eab308' },
        { value: 150, label: 'Sensitive', color: '#f97316' },
        { value: 200, label: 'Unhealthy', color: '#ef4444' },
        { value: 300, label: 'Very unhealthy', color: '#a21caf' },
        { value: 500, label: 'Hazardous', color: '#7f1d1d' },
      ],
    },
  },
  {
    id: 'forest_cover',
    label: 'Forest Cover',
    category: 'environment',
    description: 'Tree canopy density with annual loss and gain overlays.',
    render: 'raster',
    accent: '#16a34a',
    opacity: 0.7,
    order: 22,
    attribution: 'Global Forest Watch, Hansen et al.',
    refreshSeconds: 86_400,
  },
  {
    id: 'protected_areas',
    label: 'Protected Areas',
    category: 'environment',
    description: 'IUCN-categorised parks, reserves and marine protected areas.',
    render: 'vector',
    accent: '#34d399',
    opacity: 0.5,
    order: 24,
    attribution: 'Protected Planet, WDPA',
    refreshSeconds: 86_400,
  },
  {
    id: 'solar_radiation',
    label: 'Solar Radiation',
    category: 'environment',
    description: 'Global horizontal irradiance for photovoltaic yield analysis.',
    render: 'heatmap',
    accent: '#fbbf24',
    opacity: 0.65,
    order: 27,
    attribution: 'Global Solar Atlas, Open-Meteo',
    refreshSeconds: 3_600,
    legend: {
      kind: 'ramp',
      unit: 'W/m²',
      stops: [
        { value: 100, label: '100', color: '#1e1b4b' },
        { value: 300, label: '300', color: '#7c3aed' },
        { value: 500, label: '500', color: '#f59e0b' },
        { value: 800, label: '800', color: '#fde047' },
        { value: 1100, label: '1100+', color: '#fffbeb' },
      ],
    },
  },
  {
    id: 'vegetation_ndvi',
    label: 'Vegetation Health',
    category: 'environment',
    description: 'NDVI greenness anomaly against the 20-year seasonal baseline.',
    render: 'raster',
    accent: '#84cc16',
    opacity: 0.65,
    order: 23,
    attribution: 'NASA MODIS NDVI',
    refreshSeconds: 86_400,
  },
  {
    id: 'drought',
    label: 'Drought Index',
    category: 'environment',
    description: 'Combined drought indicator from soil moisture and precipitation deficit.',
    render: 'raster',
    accent: '#d97706',
    opacity: 0.6,
    order: 26,
    attribution: 'Copernicus EDO, GDO',
    refreshSeconds: 86_400,
  },
  {
    id: 'co2_emissions',
    label: 'CO₂ Emissions',
    category: 'environment',
    description: 'Gridded fossil-fuel CO₂ emission intensity with plume tracking.',
    render: 'heatmap',
    accent: '#94a3b8',
    opacity: 0.6,
    order: 25,
    attribution: 'ODIAC, Climate TRACE',
    refreshSeconds: 86_400,
    premium: true,
  },

  // ── Hazards ─────────────────────────────────────────────────────────────────
  {
    id: 'earthquakes',
    label: 'Earthquakes',
    category: 'hazard',
    description: 'USGS seismic events with magnitude-scaled, depth-coloured markers.',
    render: 'points',
    accent: '#f87171',
    opacity: 1,
    order: 70,
    attribution: 'USGS Earthquake Hazards Program',
    refreshSeconds: 300,
    legend: {
      kind: 'ramp',
      unit: 'M',
      stops: [
        { value: 2, label: 'M2', color: '#fca5a5' },
        { value: 4, label: 'M4', color: '#f87171' },
        { value: 5.5, label: 'M5.5', color: '#ef4444' },
        { value: 7, label: 'M7', color: '#b91c1c' },
        { value: 8, label: 'M8+', color: '#7f1d1d' },
      ],
    },
  },
  {
    id: 'wildfires',
    label: 'Wildfires',
    category: 'hazard',
    description: 'VIIRS/MODIS active fire detections with radiative power sizing.',
    render: 'points',
    accent: '#fb923c',
    opacity: 1,
    order: 71,
    attribution: 'NASA FIRMS',
    refreshSeconds: 900,
    requiresKey: 'NASA_FIRMS_API_KEY',
  },
  {
    id: 'volcanoes',
    label: 'Volcanoes',
    category: 'hazard',
    description: 'Holocene volcano inventory with current alert levels and ash advisories.',
    render: 'points',
    accent: '#f43f5e',
    opacity: 1,
    order: 72,
    attribution: 'Smithsonian GVP, NASA EONET',
    refreshSeconds: 3_600,
  },
  {
    id: 'floods',
    label: 'Floods',
    category: 'hazard',
    description: 'GDACS flood alerts and modelled inundation footprints.',
    render: 'vector',
    accent: '#60a5fa',
    opacity: 0.7,
    order: 73,
    attribution: 'GDACS, Copernicus EMS',
    refreshSeconds: 3_600,
  },
  {
    id: 'cyclones',
    label: 'Tropical Cyclones',
    category: 'hazard',
    description: 'Live storm positions, forecast cones and historical tracks.',
    render: 'vector',
    accent: '#22d3ee',
    opacity: 0.9,
    order: 74,
    attribution: 'NOAA NHC, JTWC, GDACS',
    refreshSeconds: 1_800,
  },
  {
    id: 'tsunami',
    label: 'Tsunami Watch',
    category: 'hazard',
    description: 'Active tsunami warnings with modelled travel-time isochrones.',
    render: 'vector',
    accent: '#818cf8',
    opacity: 0.8,
    order: 75,
    attribution: 'NOAA NTWC, PTWC',
    refreshSeconds: 600,
  },

  // ── Ocean ───────────────────────────────────────────────────────────────────
  {
    id: 'sst',
    label: 'Sea Surface Temperature',
    category: 'ocean',
    description: 'Daily foundation SST with marine heatwave anomaly highlighting.',
    render: 'heatmap',
    accent: '#f472b6',
    opacity: 0.7,
    order: 20,
    attribution: 'NOAA OISST, Copernicus Marine',
    refreshSeconds: 21_600,
    legend: {
      kind: 'ramp',
      unit: '°C',
      stops: [
        { value: -2, label: '-2', color: '#312e81' },
        { value: 8, label: '8', color: '#2563eb' },
        { value: 18, label: '18', color: '#22d3ee' },
        { value: 26, label: '26', color: '#facc15' },
        { value: 32, label: '32+', color: '#e11d48' },
      ],
    },
  },
  {
    id: 'ocean_currents',
    label: 'Ocean Currents',
    category: 'ocean',
    description: 'Surface geostrophic current vectors animated as flow lines.',
    render: 'particles',
    accent: '#67e8f9',
    opacity: 0.85,
    order: 21,
    attribution: 'NASA OSCAR, Copernicus Marine',
    refreshSeconds: 21_600,
  },
  {
    id: 'wave_height',
    label: 'Wave Height',
    category: 'ocean',
    description: 'Significant wave height with swell period and direction.',
    render: 'heatmap',
    accent: '#38bdf8',
    opacity: 0.65,
    order: 19,
    attribution: 'Open-Meteo Marine, ECMWF WAM',
    refreshSeconds: 10_800,
  },
  {
    id: 'sea_ice',
    label: 'Sea Ice',
    category: 'ocean',
    description: 'Daily polar sea-ice concentration and extent boundary.',
    render: 'raster',
    accent: '#e0f2fe',
    opacity: 0.7,
    order: 18,
    attribution: 'NSIDC, NASA AMSR2',
    refreshSeconds: 86_400,
  },
  {
    id: 'bathymetry',
    label: 'Bathymetry',
    category: 'ocean',
    description: 'GEBCO seafloor depth with trench and ridge annotation.',
    render: 'raster',
    accent: '#1d4ed8',
    opacity: 0.8,
    order: 12,
    attribution: 'GEBCO 2024 grid',
    refreshSeconds: 86_400,
  },

  // ── Society ─────────────────────────────────────────────────────────────────
  {
    id: 'population',
    label: 'Population Density',
    category: 'society',
    description: '100 m gridded population counts from WorldPop and GHSL.',
    render: 'heatmap',
    accent: '#a78bfa',
    opacity: 0.65,
    order: 28,
    attribution: 'WorldPop, JRC GHSL',
    refreshSeconds: 86_400,
    legend: {
      kind: 'ramp',
      unit: 'people/km²',
      stops: [
        { value: 1, label: '1', color: '#1e1b4b' },
        { value: 50, label: '50', color: '#4c1d95' },
        { value: 500, label: '500', color: '#7c3aed' },
        { value: 5000, label: '5k', color: '#c084fc' },
        { value: 25000, label: '25k+', color: '#fae8ff' },
      ],
    },
  },
  {
    id: 'urban_extent',
    label: 'Urban Footprint',
    category: 'society',
    description: 'Built-up surface change from 1975 to today, decade by decade.',
    render: 'raster',
    accent: '#fda4af',
    opacity: 0.6,
    order: 27,
    attribution: 'JRC GHSL Built-up',
    refreshSeconds: 86_400,
  },
  {
    id: 'night_luminosity',
    label: 'Night Luminosity',
    category: 'society',
    description: 'Monthly VIIRS radiance used as an economic activity proxy.',
    render: 'raster',
    accent: '#fde68a',
    opacity: 0.7,
    order: 26,
    attribution: 'NOAA VIIRS DNB',
    refreshSeconds: 86_400,
  },
  {
    id: 'tourism_hotspots',
    label: 'Tourism Hotspots',
    category: 'society',
    description: 'Ranked attractions, UNESCO sites and seasonal visitor pressure.',
    render: 'points',
    accent: '#f0abfc',
    opacity: 1,
    order: 64,
    attribution: 'UNESCO, OpenStreetMap, Wikidata',
    refreshSeconds: 86_400,
  },

  // ── Infrastructure ──────────────────────────────────────────────────────────
  {
    id: 'submarine_cables',
    label: 'Submarine Cables',
    category: 'infrastructure',
    description: 'Subsea fibre routes with capacity, owners and landing stations.',
    render: 'vector',
    accent: '#22d3ee',
    opacity: 0.8,
    order: 62,
    attribution: 'TeleGeography derived open data',
    refreshSeconds: 86_400,
  },
  {
    id: 'power_grid',
    label: 'Power Grid',
    category: 'infrastructure',
    description: 'Transmission lines, substations and generation plants by fuel type.',
    render: 'vector',
    accent: '#facc15',
    opacity: 0.7,
    order: 61,
    attribution: 'OpenInfraMap, WRI Global Power Plant DB',
    refreshSeconds: 86_400,
  },
  {
    id: 'traffic',
    label: 'Live Traffic',
    category: 'transport',
    description: 'Road speed relative to free-flow with incident markers.',
    render: 'raster',
    accent: '#ef4444',
    opacity: 0.8,
    order: 66,
    attribution: 'TomTom Traffic',
    refreshSeconds: 120,
    requiresKey: 'TOMTOM_API_KEY',
  },
  {
    id: 'transit',
    label: 'Transit Network',
    category: 'transport',
    description: 'Metro, rail, tram and ferry lines with station interchanges.',
    render: 'vector',
    accent: '#4ade80',
    opacity: 0.8,
    order: 65,
    attribution: 'OpenStreetMap, Transitland',
    refreshSeconds: 86_400,
  },
  {
    id: 'flights',
    label: 'Live Flights',
    category: 'transport',
    description: 'ADS-B aircraft positions with altitude-tinted heading icons.',
    render: 'points',
    accent: '#facc15',
    opacity: 1,
    order: 80,
    attribution: 'OpenSky Network',
    refreshSeconds: 15,
  },
  {
    id: 'ships',
    label: 'Live Ships',
    category: 'transport',
    description: 'AIS vessel positions classified by type, draught and destination.',
    render: 'points',
    accent: '#38bdf8',
    opacity: 1,
    order: 79,
    attribution: 'AISStream, open AIS receivers',
    refreshSeconds: 30,
    requiresKey: 'AISSTREAM_API_KEY',
  },
  {
    id: 'airports',
    label: 'Airports',
    category: 'transport',
    description: 'Commercial airports sized by annual passenger throughput.',
    render: 'points',
    accent: '#fdba74',
    opacity: 1,
    order: 63,
    attribution: 'OurAirports',
    refreshSeconds: 86_400,
  },
  {
    id: 'seaports',
    label: 'Seaports',
    category: 'transport',
    description: 'Container ports ranked by TEU with congestion indicators.',
    render: 'points',
    accent: '#7dd3fc',
    opacity: 1,
    order: 63,
    attribution: 'UNCTAD, World Port Index',
    refreshSeconds: 86_400,
  },

  // ── Space ───────────────────────────────────────────────────────────────────
  {
    id: 'satellites',
    label: 'Satellites',
    category: 'space',
    description: 'Orbital objects propagated from TLEs with ground-track projection.',
    render: 'points',
    accent: '#c4b5fd',
    opacity: 1,
    order: 85,
    attribution: 'CelesTrak TLE catalogue',
    refreshSeconds: 60,
  },
  {
    id: 'iss',
    label: 'ISS Live',
    category: 'space',
    description: 'International Space Station position, path and visibility windows.',
    render: 'model',
    accent: '#e879f9',
    opacity: 1,
    order: 86,
    attribution: 'Open Notify, CelesTrak',
    refreshSeconds: 10,
  },
  {
    id: 'aurora',
    label: 'Aurora Forecast',
    category: 'space',
    description: 'OVATION auroral oval probability driven by live Kp index.',
    render: 'heatmap',
    accent: '#4ade80',
    opacity: 0.6,
    order: 84,
    attribution: 'NOAA SWPC',
    refreshSeconds: 1_800,
  },
  {
    id: 'day_night',
    label: 'Day / Night Terminator',
    category: 'space',
    description: 'Solar terminator with civil, nautical and astronomical twilight bands.',
    render: 'vector',
    accent: '#1e293b',
    opacity: 0.45,
    order: 50,
    attribution: 'Earth Digital Twin solar model',
    refreshSeconds: 60,
  },
] as const;

export const LAYER_IDS = LAYERS.map((l) => l.id);

export const DEFAULT_LAYER_IDS = ['borders', 'labels', 'day_night'];

export const LAYER_CATEGORY_LABEL: Record<LayerCategory, string> = {
  base: 'Basemaps',
  reference: 'Reference',
  weather: 'Weather',
  environment: 'Environment',
  hazard: 'Hazards',
  ocean: 'Ocean',
  society: 'Society',
  infrastructure: 'Infrastructure',
  transport: 'Transport',
  space: 'Space',
};

export const LAYER_CATEGORY_ORDER: LayerCategory[] = [
  'reference',
  'weather',
  'hazard',
  'environment',
  'ocean',
  'society',
  'transport',
  'infrastructure',
  'space',
  'base',
];

export function getLayer(id: string): LayerDefinition | undefined {
  return LAYERS.find((layer) => layer.id === id);
}

export function getBasemap(id: string): BasemapDefinition | undefined {
  return BASEMAPS.find((basemap) => basemap.id === id);
}

export function isLayerId(id: string): boolean {
  return LAYERS.some((layer) => layer.id === id);
}
