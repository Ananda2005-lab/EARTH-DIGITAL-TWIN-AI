import type { BBox, LngLat } from './geo';

export type Continent =
  | 'Africa'
  | 'Antarctica'
  | 'Asia'
  | 'Europe'
  | 'North America'
  | 'Oceania'
  | 'South America';

export interface CountrySummary {
  /** ISO 3166-1 alpha-2. */
  code: string;
  /** ISO 3166-1 alpha-3. */
  code3: string;
  name: string;
  officialName: string;
  continent: Continent;
  subregion: string | null;
  capital: string | null;
  population: number;
  areaKm2: number;
  flagEmoji: string;
  center: LngLat;
  bbox?: BBox;
}

export interface CountryDetail extends CountrySummary {
  currencies: Currency[];
  languages: Language[];
  timezones: string[];
  callingCodes: string[];
  tld: string[];
  drivingSide: 'left' | 'right' | null;
  independent: boolean;
  unMember: boolean;
  landlocked: boolean;
  borders: string[];
  /** Nominal GDP in current USD. */
  gdpUsd: number | null;
  gdpPerCapitaUsd: number | null;
  gdpGrowthPct: number | null;
  lifeExpectancy: number | null;
  hdi: number | null;
  urbanPopulationPct: number | null;
  literacyPct: number | null;
  internetUsersPct: number | null;
  co2TonnesPerCapita: number | null;
  renewableEnergyPct: number | null;
  forestAreaPct: number | null;
  populationDensity: number;
  medianAge: number | null;
  fertilityRate: number | null;
  unemploymentPct: number | null;
  inflationPct: number | null;
  militaryExpenditurePctGdp: number | null;
  touristArrivals: number | null;
  flagSvgUrl: string;
  coatOfArmsUrl: string | null;
  mapsUrl: string | null;
  wikipediaUrl: string | null;
  updatedAt: string;
}

export interface Currency {
  code: string;
  name: string;
  symbol: string | null;
}

export interface Language {
  code: string;
  name: string;
}

export interface CitySummary {
  id: string;
  name: string;
  asciiName: string;
  countryCode: string;
  countryName: string;
  admin1: string | null;
  population: number;
  center: LngLat;
  elevationM: number | null;
  timezone: string;
  /** True for national capitals. */
  isCapital: boolean;
}

export interface CityDetail extends CitySummary {
  metroPopulation: number | null;
  areaKm2: number | null;
  populationDensity: number | null;
  foundedYear: number | null;
  gdpUsd: number | null;
  costOfLivingIndex: number | null;
  qualityOfLifeIndex: number | null;
  safetyIndex: number | null;
  transitScore: number | null;
  walkScore: number | null;
  averageTemperature: number | null;
  averageAqi: number | null;
  nearestAirports: string[];
  sisterCities: string[];
  wikipediaUrl: string | null;
  summary: string | null;
  updatedAt: string;
}

export interface TimezoneInfo {
  id: string;
  abbreviation: string;
  /** Offset from UTC in minutes, DST aware. */
  utcOffsetMinutes: number;
  dstActive: boolean;
  localTime: string;
  countryCodes: string[];
}

export interface PopulationPyramidBucket {
  ageFrom: number;
  ageTo: number;
  male: number;
  female: number;
}

export interface TimeSeriesPoint {
  year: number;
  value: number;
}

export interface IndicatorSeries {
  indicator: string;
  label: string;
  unit: string;
  source: string;
  points: TimeSeriesPoint[];
}
