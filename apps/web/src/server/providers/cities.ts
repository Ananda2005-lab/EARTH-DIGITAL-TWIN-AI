/**
 * City gazetteer provider.
 *
 * The live source is the gazetteer API (Postgres-backed, ~210 capital cities
 * seeded from country + Open-Meteo geocoding data). Pages call the API through
 * the same-origin `/api` proxy and fall back to the small bundled curated list
 * when the gateway is unreachable, so city pages never 500 while the stack is
 * down.
 */

import type { CityDetail, CitySummary, PaginatedResult } from '@edt/shared';

import { api } from '@/lib/api/client';

export interface CityLite {
  id: string;
  name: string;
  countryCode: string;
  population: number;
  center: { lng: number; lat: number };
}

/** DB-compatible slug: matches the seed's `slugify(asciiName)` per country. */
function nameSlug(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 72) || 'place'
  );
}

/** Stable web id: `<name-slug>-<country-code-lower>`. Round-trips to by-slug. */
function webId(summary: Pick<CitySummary, 'asciiName' | 'name' | 'countryCode'>): string {
  return `${nameSlug(summary.asciiName || summary.name)}-${summary.countryCode.toLowerCase()}`;
}

/** Everything the curated list used to provide, kept as an offline fallback. */
const RAW_CITIES: readonly [
  name: string,
  countryCode: string,
  population: number,
  lng: number,
  lat: number,
][] = [
  ['Tokyo', 'JP', 37_400_000, 139.6917, 35.6895],
  ['Delhi', 'IN', 32_900_000, 77.1025, 28.7041],
  ['Shanghai', 'CN', 29_200_000, 121.4737, 31.2304],
  ['São Paulo', 'BR', 22_400_000, -46.6333, -23.5505],
  ['Mexico City', 'MX', 22_200_000, -99.1332, 19.4326],
  ['Cairo', 'EG', 21_300_000, 31.2357, 30.0444],
  ['Mumbai', 'IN', 20_700_000, 72.8777, 19.076],
  ['Beijing', 'CN', 20_500_000, 116.4074, 39.9042],
  ['Dhaka', 'BD', 21_700_000, 90.4125, 23.8103],
  ['Osaka', 'JP', 19_100_000, 135.5023, 34.6937],
  ['New York', 'US', 18_800_000, -74.006, 40.7128],
  ['Karachi', 'PK', 16_800_000, 67.0011, 24.8607],
  ['Chongqing', 'CN', 16_400_000, 106.5516, 29.563],
  ['Istanbul', 'TR', 15_500_000, 28.9784, 41.0082],
  ['Buenos Aires', 'AR', 15_200_000, -58.3816, -34.6037],
  ['Kolkata', 'IN', 14_900_000, 88.3639, 22.5726],
  ['Lagos', 'NG', 14_800_000, 3.3792, 6.5244],
  ['Manila', 'PH', 14_200_000, 120.9842, 14.5995],
  ['Tianjin', 'CN', 13_800_000, 117.201, 39.0842],
  ['Guangzhou', 'CN', 13_600_000, 113.2644, 23.1291],
  ['Rio de Janeiro', 'BR', 13_500_000, -43.1729, -22.9068],
  ['Lahore', 'PK', 13_100_000, 74.3587, 31.5497],
  ['Bangalore', 'IN', 13_200_000, 77.5946, 12.9716],
  ['Paris', 'FR', 11_000_000, 2.3522, 48.8566],
  ['Bogotá', 'CO', 11_000_000, -74.0721, 4.711],
  ['Jakarta', 'ID', 10_900_000, 106.8456, -6.2088],
  ['Chennai', 'IN', 10_900_000, 80.2707, 13.0827],
  ['Lima', 'PE', 10_700_000, -77.0428, -12.0464],
  ['Bangkok', 'TH', 10_700_000, 100.5018, 13.7563],
  ['Seoul', 'KR', 9_900_000, 126.978, 37.5665],
  ['Nagoya', 'JP', 9_500_000, 136.9066, 35.1815],
  ['Hyderabad', 'IN', 10_000_000, 78.4867, 17.385],
  ['London', 'GB', 9_500_000, -0.1278, 51.5074],
  ['Tehran', 'IR', 9_100_000, 51.389, 35.6892],
  ['Chicago', 'US', 8_900_000, -87.6298, 41.8781],
  ['Chengdu', 'CN', 9_100_000, 104.0668, 30.5728],
  ['Nanjing', 'CN', 8_800_000, 118.7969, 32.0603],
  ['Wuhan', 'CN', 8_400_000, 114.3055, 30.5928],
  ['Ho Chi Minh City', 'VN', 8_600_000, 106.6297, 10.8231],
  ['Luanda', 'AO', 8_400_000, 13.2343, -8.839],
  ['Ahmedabad', 'IN', 8_400_000, 72.5714, 23.0225],
];

function slugify(name: string, countryCode: string): string {
  return `${nameSlug(name)}-${countryCode.toLowerCase()}`;
}

const MAJOR_CITIES: readonly CityLite[] = RAW_CITIES.map(
  ([name, countryCode, population, lng, lat]) => ({
    id: slugify(name, countryCode),
    name,
    countryCode,
    population,
    center: { lng, lat },
  }),
);

/** Curated list of ~40 major world cities, sorted by population descending. */
export async function getMajorCities(): Promise<CityLite[]> {
  return [...MAJOR_CITIES].sort((a, b) => b.population - a.population);
}

/**
 * Top cities from the live gazetteer API. Falls back to the curated list when
 * the gateway is unreachable so `/cities` still renders offline.
 */
export async function getGazetteerCities(): Promise<CityLite[]> {
  const results: CitySummary[] = [];
  try {
    let page = 1;
    // The schema caps pageSize at 200; walk pages until the seed set is covered.
    for (;;) {
      const batch = await api<PaginatedResult<CitySummary>>('/cities', {
        query: { page, pageSize: 200, sortBy: 'population', sortDir: 'desc' },
        revalidate: 86_400,
      });
      results.push(...batch.items);
      if (!batch.hasNext || results.length >= 500) break;
      page += 1;
    }
  } catch {
    return getMajorCities();
  }
  if (results.length === 0) return getMajorCities();
  return results.map((entry) => ({
    id: webId(entry),
    name: entry.name,
    countryCode: entry.countryCode,
    population: entry.population,
    center: entry.center,
  }));
}

/**
 * Resolve a web slug id (`tokyo-jp`) against the live gazetteer. Falls back to
 * the curated list so the bundled majors keep working when the API is down.
 */
export async function getCityByIdentifier(id: string): Promise<CityLite | null> {
  const match = /^(.+)-([a-z]{2})$/.exec(id);
  const slug = match?.[1];
  const countryCode = match?.[2];
  if (slug && countryCode) {
    try {
      const detail = await api<CityDetail>(
        `/cities/by-slug/${countryCode.toUpperCase()}/${slug}`,
        { revalidate: 86_400 },
      );
      return {
        id,
        name: detail.name,
        countryCode: detail.countryCode,
        population: detail.population,
        center: detail.center,
      };
    } catch {
      // 404 or gateway down — fall through to the curated lookup.
    }
  }
  const curated = await getMajorCities();
  return curated.find((entry) => entry.id === id) ?? null;
}
