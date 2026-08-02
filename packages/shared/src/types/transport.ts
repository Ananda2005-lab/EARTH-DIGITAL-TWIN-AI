import type { BBox, LngLat } from './geo';

export type FlightPhase = 'ground' | 'climb' | 'cruise' | 'descent' | 'unknown';

export interface FlightState {
  /** ICAO 24-bit transponder address, stable per airframe. */
  icao24: string;
  callsign: string | null;
  originCountry: string;
  position: LngLat;
  /** Barometric altitude in metres. */
  altitude: number | null;
  /** Geometric altitude in metres. */
  geoAltitude: number | null;
  /** Ground speed in km/h. */
  velocity: number | null;
  /** True track in degrees clockwise from north. */
  heading: number | null;
  /** Vertical rate in m/s, positive = climbing. */
  verticalRate: number | null;
  onGround: boolean;
  phase: FlightPhase;
  squawk: string | null;
  spi: boolean;
  lastContact: string;
}

export interface FlightFeed {
  flights: FlightState[];
  total: number;
  bbox?: BBox;
  attribution: string;
  fetchedAt: string;
}

export interface Airport {
  iata: string | null;
  icao: string;
  name: string;
  city: string | null;
  countryCode: string;
  location: LngLat;
  elevationM: number | null;
  timezone: string | null;
  /** Annual passenger throughput when known. */
  passengers?: number;
}

export type VesselKind =
  | 'cargo'
  | 'tanker'
  | 'passenger'
  | 'fishing'
  | 'tug'
  | 'sailing'
  | 'high_speed'
  | 'military'
  | 'pleasure'
  | 'other';

export interface VesselState {
  mmsi: string;
  name: string | null;
  callsign: string | null;
  kind: VesselKind;
  flagCountryCode: string | null;
  position: LngLat;
  /** Speed over ground in knots. */
  sog: number | null;
  /** Course over ground in degrees. */
  cog: number | null;
  heading: number | null;
  navStatus: string | null;
  destination: string | null;
  eta: string | null;
  draughtM: number | null;
  lengthM: number | null;
  widthM: number | null;
  lastContact: string;
}

export interface VesselFeed {
  vessels: VesselState[];
  total: number;
  bbox?: BBox;
  attribution: string;
  fetchedAt: string;
}

export interface Seaport {
  code: string;
  name: string;
  countryCode: string;
  location: LngLat;
  /** Annual container throughput in TEU when known. */
  teu?: number;
}
