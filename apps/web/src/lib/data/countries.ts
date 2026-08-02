import type { Continent, CountrySummary, Currency, Language, LngLat } from '@edt/shared';
import reference from './country-reference.json';

/**
 * Vendored country reference data.
 *
 * Regenerate with `node scripts/build-country-index.mjs`.
 * Sources: mledoze/countries (ODbL 1.0) and the World Bank Open Data API.
 */
export interface CountryReference {
  /** Numeric ISO 3166-1 code, matching Natural Earth TopoJSON feature ids. */
  numeric: string | null;
  code: string;
  code3: string;
  name: string;
  officialName: string;
  continent: Continent;
  region: string | null;
  subregion: string | null;
  capital: string | null;
  capitalCenter: LngLat | null;
  center: LngLat;
  population: number;
  populationYear: number | null;
  areaKm2: number;
  flagEmoji: string;
  currencies: Currency[];
  languages: Language[];
  callingCodes: string[];
  tld: string[];
  independent: boolean;
  unMember: boolean;
  landlocked: boolean;
  borders: string[];
  demonym: string | null;
  incomeGroup: string | null;
  altSpellings: string[];
}

export const COUNTRIES = reference as unknown as CountryReference[];

const byCode = new Map(COUNTRIES.map((c) => [c.code, c]));
const byCode3 = new Map(COUNTRIES.map((c) => [c.code3, c]));
const byNumeric = new Map(
  COUNTRIES.filter((c) => c.numeric).map((c) => [String(Number(c.numeric)), c]),
);

export function countryByCode(code: string | null | undefined): CountryReference | undefined {
  if (!code) return undefined;
  const key = code.trim().toUpperCase();
  return byCode.get(key) ?? byCode3.get(key);
}

/** Resolve a Natural Earth numeric id (e.g. "392") to a country record. */
export function countryByNumeric(numeric: string | number): CountryReference | undefined {
  return byNumeric.get(String(Number(numeric)));
}

export function countrySummary(country: CountryReference): CountrySummary {
  return {
    code: country.code,
    code3: country.code3,
    name: country.name,
    officialName: country.officialName,
    continent: country.continent,
    subregion: country.subregion,
    capital: country.capital,
    population: country.population,
    areaKm2: country.areaKm2,
    flagEmoji: country.flagEmoji,
    center: country.capitalCenter ?? country.center,
  };
}

export function flagUrl(code: string, width: 20 | 40 | 80 | 160 | 320 = 80): string {
  return `https://flagcdn.com/w${width}/${code.toLowerCase()}.png`;
}

export function flagSvgUrl(code: string): string {
  return `https://flagcdn.com/${code.toLowerCase()}.svg`;
}

export const CONTINENTS: readonly Continent[] = [
  'Africa',
  'Asia',
  'Europe',
  'North America',
  'South America',
  'Oceania',
  'Antarctica',
];

/** Fuzzy country lookup used by search, the AI tool layer and URL resolution. */
export function findCountries(query: string, limit = 8): CountryReference[] {
  const q = normalise(query);
  if (q.length === 0) return [];
  const scored: { country: CountryReference; score: number }[] = [];
  for (const country of COUNTRIES) {
    const name = normalise(country.name);
    let score = 0;
    if (name === q || normalise(country.code) === q || normalise(country.code3) === q) score = 100;
    else if (name.startsWith(q)) score = 80;
    else if (name.includes(q)) score = 60;
    else if (normalise(country.officialName).includes(q)) score = 50;
    else if (country.altSpellings.some((alt) => normalise(alt).startsWith(q))) score = 40;
    else if (country.capital && normalise(country.capital).startsWith(q)) score = 30;
    if (score > 0) {
      // Prefer larger, sovereign states when scores tie.
      scored.push({ country, score: score + (country.unMember ? 5 : 0) + Math.min(4, Math.log10(country.population + 1)) });
    }
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.country);
}

function normalise(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export const COUNTRY_STATS = {
  total: COUNTRIES.length,
  sovereign: COUNTRIES.filter((c) => c.independent).length,
  unMembers: COUNTRIES.filter((c) => c.unMember).length,
  landlocked: COUNTRIES.filter((c) => c.landlocked).length,
  totalPopulation: COUNTRIES.reduce((sum, c) => sum + c.population, 0),
  totalAreaKm2: COUNTRIES.reduce((sum, c) => sum + c.areaKm2, 0),
} as const;
