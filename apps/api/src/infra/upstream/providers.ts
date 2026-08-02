/**
 * Registry of every third-party the gateway talks to.
 *
 * Cache TTLs are chosen per provider from how often the source actually
 * refreshes, so the platform stays inside free-tier quotas while feeling live.
 */
export const UPSTREAM_PROVIDERS = {
  openMeteoForecast: { label: 'Open-Meteo Forecast', ttl: 600, attribution: 'Open-Meteo · ECMWF IFS · NOAA GFS' },
  openMeteoAirQuality: { label: 'Open-Meteo Air Quality', ttl: 1800, attribution: 'Copernicus CAMS via Open-Meteo' },
  openMeteoArchive: { label: 'Open-Meteo Archive', ttl: 86_400, attribution: 'ERA5 reanalysis via Open-Meteo' },
  openMeteoMarine: { label: 'Open-Meteo Marine', ttl: 10_800, attribution: 'Open-Meteo Marine · ECMWF WAM' },
  openMeteoGeocoding: { label: 'Open-Meteo Geocoding', ttl: 3600, attribution: 'Open-Meteo Geocoding · GeoNames' },
  openMeteoElevation: { label: 'Open-Meteo Elevation', ttl: 86_400, attribution: 'Copernicus DEM via Open-Meteo' },
  usgs: { label: 'USGS Earthquakes', ttl: 300, attribution: 'USGS Earthquake Hazards Program' },
  eonet: { label: 'NASA EONET', ttl: 1800, attribution: 'NASA EONET' },
  firms: { label: 'NASA FIRMS', ttl: 900, attribution: 'NASA FIRMS VIIRS' },
  gdacs: { label: 'GDACS', ttl: 1800, attribution: 'GDACS (JRC / UN OCHA)' },
  openSky: { label: 'OpenSky Network', ttl: 20, attribution: 'OpenSky Network' },
  aisStream: { label: 'AISStream', ttl: 30, attribution: 'AISStream · open AIS receivers' },
  worldBank: { label: 'World Bank', ttl: 86_400, attribution: 'World Bank Open Data' },
  noaaSwpc: { label: 'NOAA SWPC', ttl: 900, attribution: 'NOAA Space Weather Prediction Center' },
  celestrak: { label: 'CelesTrak', ttl: 21_600, attribution: 'CelesTrak TLE catalogue' },
  issTracker: { label: 'WhereTheISS.at', ttl: 10, attribution: 'WhereTheISS.at' },
  wikipedia: { label: 'Wikipedia', ttl: 86_400, attribution: 'Wikipedia (CC BY-SA)' },
  bigDataCloud: { label: 'BigDataCloud', ttl: 3600, attribution: 'BigDataCloud reverse geocoder' },
  aiService: { label: 'EDT AI Service', ttl: 0, attribution: 'Earth Digital Twin AI' },
} as const;

export type ProviderKey = keyof typeof UPSTREAM_PROVIDERS;

export const PROVIDER_KEYS = Object.keys(UPSTREAM_PROVIDERS) as ProviderKey[];

export function providerTtl(provider: ProviderKey): number {
  return UPSTREAM_PROVIDERS[provider].ttl;
}

export function providerAttribution(provider: ProviderKey): string {
  return UPSTREAM_PROVIDERS[provider].attribution;
}

export const UPSTREAM_URLS = {
  openMeteoForecast: 'https://api.open-meteo.com/v1/forecast',
  openMeteoAirQuality: 'https://air-quality-api.open-meteo.com/v1/air-quality',
  openMeteoArchive: 'https://archive-api.open-meteo.com/v1/archive',
  openMeteoMarine: 'https://marine-api.open-meteo.com/v1/marine',
  openMeteoGeocoding: 'https://geocoding-api.open-meteo.com/v1/search',
  openMeteoElevation: 'https://api.open-meteo.com/v1/elevation',
  usgsQuery: 'https://earthquake.usgs.gov/fdsnws/event/1/query',
  eonetEvents: 'https://eonet.gsfc.nasa.gov/api/v3/events',
  firmsArea: 'https://firms.modaps.eosdis.nasa.gov/api/area/csv',
  gdacsEvents: 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP',
  openSkyStates: 'https://opensky-network.org/api/states/all',
  openSkyToken:
    'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',
  aisStream: 'wss://stream.aisstream.io/v0/stream',
  worldBank: 'https://api.worldbank.org/v2',
  swpcKpIndex: 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json',
  swpcPlasma: 'https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json',
  swpcMagnetics: 'https://services.swpc.noaa.gov/products/solar-wind/mag-1-day.json',
  swpcSolarFlux: 'https://services.swpc.noaa.gov/json/f107_cm_flux.json',
  swpcAuroraForecast: 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json',
  celestrakGroup: 'https://celestrak.org/NORAD/elements/gp.php',
  issPosition: 'https://api.wheretheiss.at/v1/satellites/25544',
  wikipediaSummary: 'https://en.wikipedia.org/api/rest_v1/page/summary',
  reverseGeocode: 'https://api.bigdatacloud.net/data/reverse-geocode-client',
} as const;
