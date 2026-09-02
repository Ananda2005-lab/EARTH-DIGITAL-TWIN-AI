/**
<<<<<<< HEAD
 * Cities provider - hardcoded comprehensive list with 150+ major cities.
 * Each city has complete details: population, timezone, coordinates, etc.
 */

import type { LngLat } from '@edt/shared';

import cityReference from '@/lib/data/city-reference.json';
=======
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
>>>>>>> 005c357b565eaf6ff99b0cc04ff8ed07cf1d64a0

export interface CityLite {
  id: string;
  name: string;
  countryCode: string;
  population: number;
  center: LngLat;
}

<<<<<<< HEAD
/** Raw seed shape used by CITIES_DATA; public helpers map it to CityDetail/CityLite. */
interface RawCity {
  name: string;
  countryCode: string;
  population: number;
  lng: number;
  lat: number;
  timezone: string;
  isCapital: boolean;
  metroPopulation?: number;
  areaKm2?: number;
  elevationM?: number;
  admin1?: string;
}

export interface CityDetail {
  id: string;
  name: string;
  countryCode: string;
  population: number;
  center: LngLat;
  timezone: string;
  isCapital: boolean;
  metroPopulation?: number;
  areaKm2?: number;
  elevationM?: number;
  admin1?: string;
}

function slugify(name: string, countryCode: string): string {
  const namePart = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${namePart}-${countryCode.toLowerCase()}`;
=======
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
>>>>>>> 005c357b565eaf6ff99b0cc04ff8ed07cf1d64a0
}

// Comprehensive list of 150+ major cities worldwide with full details
const CITIES_DATA: RawCity[] = [
  {name: "Tokyo", countryCode: "JP", population: 37400000, lng: 139.6917, lat: 35.6895, timezone: "Asia/Tokyo", isCapital: true, metroPopulation: 37400000, areaKm2: 2188, elevationM: 40},
  {name: "Delhi", countryCode: "IN", population: 32900000, lng: 77.1025, lat: 28.7041, timezone: "Asia/Kolkata", isCapital: true, metroPopulation: 32900000, areaKm2: 1484, elevationM: 216},
  {name: "Shanghai", countryCode: "CN", population: 29200000, lng: 121.4737, lat: 31.2304, timezone: "Asia/Shanghai", isCapital: false, metroPopulation: 29200000, areaKm2: 6341, elevationM: 4},
  {name: "São Paulo", countryCode: "BR", population: 22400000, lng: -46.6333, lat: -23.5505, timezone: "America/Sao_Paulo", isCapital: false, metroPopulation: 22400000, areaKm2: 1521, elevationM: 760},
  {name: "Mexico City", countryCode: "MX", population: 22200000, lng: -99.1332, lat: 19.4326, timezone: "America/Mexico_City", isCapital: true, metroPopulation: 22200000, areaKm2: 1485, elevationM: 2250},
  {name: "Cairo", countryCode: "EG", population: 21300000, lng: 31.2357, lat: 30.0444, timezone: "Africa/Cairo", isCapital: true, metroPopulation: 21300000, areaKm2: 3085, elevationM: 23},
  {name: "Mumbai", countryCode: "IN", population: 20700000, lng: 72.8777, lat: 19.076, timezone: "Asia/Kolkata", isCapital: false, metroPopulation: 20700000, areaKm2: 603, elevationM: 14},
  {name: "Beijing", countryCode: "CN", population: 20500000, lng: 116.4074, lat: 39.9042, timezone: "Asia/Shanghai", isCapital: true, metroPopulation: 20500000, areaKm2: 16801, elevationM: 52},
  {name: "Dhaka", countryCode: "BD", population: 21700000, lng: 90.4125, lat: 23.8103, timezone: "Asia/Dhaka", isCapital: true, metroPopulation: 21700000, areaKm2: 1530, elevationM: 6},
  {name: "Osaka", countryCode: "JP", population: 19100000, lng: 135.5023, lat: 34.6937, timezone: "Asia/Tokyo", isCapital: false, metroPopulation: 19100000, areaKm2: 1897, elevationM: 1},
  {name: "New York", countryCode: "US", population: 18800000, lng: -74.006, lat: 40.7128, timezone: "America/New_York", isCapital: false, metroPopulation: 18800000, areaKm2: 783, elevationM: 10},
  {name: "Karachi", countryCode: "PK", population: 16800000, lng: 67.0011, lat: 24.8607, timezone: "Asia/Karachi", isCapital: false, metroPopulation: 16800000, areaKm2: 3530, elevationM: 5},
  {name: "Chongqing", countryCode: "CN", population: 16400000, lng: 106.5516, lat: 29.563, timezone: "Asia/Shanghai", isCapital: false, metroPopulation: 16400000, areaKm2: 82403, elevationM: 259},
  {name: "Istanbul", countryCode: "TR", population: 15500000, lng: 28.9784, lat: 41.0082, timezone: "Europe/Istanbul", isCapital: false, metroPopulation: 15500000, areaKm2: 5343, elevationM: 39},
  {name: "Buenos Aires", countryCode: "AR", population: 15200000, lng: -58.3816, lat: -34.6037, timezone: "America/Argentina/Buenos_Aires", isCapital: true, metroPopulation: 15200000, areaKm2: 203, elevationM: 25},
  {name: "Kolkata", countryCode: "IN", population: 14900000, lng: 88.3639, lat: 22.5726, timezone: "Asia/Kolkata", isCapital: false, metroPopulation: 14900000, areaKm2: 1886, elevationM: 9},
  {name: "Lagos", countryCode: "NG", population: 14800000, lng: 3.3792, lat: 6.5244, timezone: "Africa/Lagos", isCapital: false, metroPopulation: 14800000, areaKm2: 3577, elevationM: 16},
  {name: "Manila", countryCode: "PH", population: 14200000, lng: 120.9842, lat: 14.5995, timezone: "Asia/Manila", isCapital: true, metroPopulation: 14200000, areaKm2: 2431, elevationM: 14},
  {name: "Tianjin", countryCode: "CN", population: 13800000, lng: 117.201, lat: 39.0842, timezone: "Asia/Shanghai", isCapital: false, metroPopulation: 13800000, areaKm2: 11760, elevationM: 3},
  {name: "Guangzhou", countryCode: "CN", population: 13600000, lng: 113.2644, lat: 23.1291, timezone: "Asia/Shanghai", isCapital: false, metroPopulation: 13600000, areaKm2: 7434, elevationM: 5},
  {name: "Rio de Janeiro", countryCode: "BR", population: 13500000, lng: -43.1729, lat: -22.9068, timezone: "America/Sao_Paulo", isCapital: false, metroPopulation: 13500000, areaKm2: 1182, elevationM: 5},
  {name: "Lahore", countryCode: "PK", population: 13100000, lng: 74.3587, lat: 31.5497, timezone: "Asia/Karachi", isCapital: false, metroPopulation: 13100000, areaKm2: 1772, elevationM: 214},
  {name: "Bangalore", countryCode: "IN", population: 13200000, lng: 77.5946, lat: 12.9716, timezone: "Asia/Kolkata", isCapital: false, metroPopulation: 13200000, areaKm2: 2191, elevationM: 920},
  {name: "Paris", countryCode: "FR", population: 11000000, lng: 2.3522, lat: 48.8566, timezone: "Europe/Paris", isCapital: true, metroPopulation: 11000000, areaKm2: 105, elevationM: 35},
  {name: "Bogotá", countryCode: "CO", population: 11000000, lng: -74.0721, lat: 4.711, timezone: "America/Bogota", isCapital: true, metroPopulation: 11000000, areaKm2: 1587, elevationM: 2640},
  {name: "Jakarta", countryCode: "ID", population: 10900000, lng: 106.8456, lat: -6.2088, timezone: "Asia/Jakarta", isCapital: true, metroPopulation: 10900000, areaKm2: 662, elevationM: 8},
  {name: "Chennai", countryCode: "IN", population: 10900000, lng: 80.2707, lat: 13.0827, timezone: "Asia/Kolkata", isCapital: false, metroPopulation: 10900000, areaKm2: 1189, elevationM: 7},
  {name: "Lima", countryCode: "PE", population: 10700000, lng: -77.0428, lat: -12.0464, timezone: "America/Lima", isCapital: true, metroPopulation: 10700000, areaKm2: 2819, elevationM: 505},
  {name: "Bangkok", countryCode: "TH", population: 10700000, lng: 100.5018, lat: 13.7563, timezone: "Asia/Bangkok", isCapital: true, metroPopulation: 10700000, areaKm2: 1568, elevationM: 2},
  {name: "Moscow", countryCode: "RU", population: 12700000, lng: 37.6173, lat: 55.7558, timezone: "Europe/Moscow", isCapital: true, metroPopulation: 12700000, areaKm2: 2511, elevationM: 118},
  {name: "Los Angeles", countryCode: "US", population: 12300000, lng: -118.2437, lat: 34.0522, timezone: "America/Los_Angeles", isCapital: false, metroPopulation: 12300000, areaKm2: 1302, elevationM: 95},
  {name: "Seoul", countryCode: "KR", population: 9900000, lng: 126.978, lat: 37.5665, timezone: "Asia/Seoul", isCapital: true, metroPopulation: 9900000, areaKm2: 605, elevationM: 38},
  {name: "Nagoya", countryCode: "JP", population: 9500000, lng: 136.9066, lat: 35.1815, timezone: "Asia/Tokyo", isCapital: false, metroPopulation: 9500000, areaKm2: 326, elevationM: 3},
  {name: "Hyderabad", countryCode: "IN", population: 10000000, lng: 78.4867, lat: 17.385, timezone: "Asia/Kolkata", isCapital: false, metroPopulation: 10000000, areaKm2: 2256, elevationM: 505},
  {name: "London", countryCode: "GB", population: 9500000, lng: -0.1278, lat: 51.5074, timezone: "Europe/London", isCapital: true, metroPopulation: 9500000, areaKm2: 1572, elevationM: 11},
  {name: "Tehran", countryCode: "IR", population: 9100000, lng: 51.389, lat: 35.6892, timezone: "Asia/Tehran", isCapital: true, metroPopulation: 9100000, areaKm2: 730, elevationM: 1191},
  {name: "Chicago", countryCode: "US", population: 8900000, lng: -87.6298, lat: 41.8781, timezone: "America/Chicago", isCapital: false, metroPopulation: 8900000, areaKm2: 606, elevationM: 181},
  {name: "Chengdu", countryCode: "CN", population: 9100000, lng: 104.0668, lat: 30.5728, timezone: "Asia/Shanghai", isCapital: false, metroPopulation: 9100000, areaKm2: 12390, elevationM: 506},
  {name: "Nanjing", countryCode: "CN", population: 8800000, lng: 118.7969, lat: 32.0603, timezone: "Asia/Shanghai", isCapital: false, metroPopulation: 8800000, areaKm2: 6598, elevationM: 9},
  {name: "Wuhan", countryCode: "CN", population: 8400000, lng: 114.3055, lat: 30.5928, timezone: "Asia/Shanghai", isCapital: false, metroPopulation: 8400000, areaKm2: 8494, elevationM: 23},
  {name: "Ho Chi Minh City", countryCode: "VN", population: 8600000, lng: 106.6297, lat: 10.8231, timezone: "Asia/Ho_Chi_Minh", isCapital: false, metroPopulation: 8600000, areaKm2: 2090, elevationM: 10},
  {name: "Luanda", countryCode: "AO", population: 8400000, lng: 13.2343, lat: -8.839, timezone: "Africa/Luanda", isCapital: true, metroPopulation: 8400000, areaKm2: 2418, elevationM: 58},
  {name: "Ahmedabad", countryCode: "IN", population: 8400000, lng: 72.5714, lat: 23.0225, timezone: "Asia/Kolkata", isCapital: false, metroPopulation: 8400000, areaKm2: 1866, elevationM: 53},
  {name: "Singapore", countryCode: "SG", population: 5850000, lng: 103.8198, lat: 1.3521, timezone: "Asia/Singapore", isCapital: true, metroPopulation: 5850000, areaKm2: 728, elevationM: 15},
  {name: "Hong Kong", countryCode: "HK", population: 7500000, lng: 114.1733, lat: 22.3193, timezone: "Asia/Hong_Kong", isCapital: false, metroPopulation: 7500000, areaKm2: 2754, elevationM: 550},
  {name: "Dubai", countryCode: "AE", population: 3600000, lng: 55.2708, lat: 25.2048, timezone: "Asia/Dubai", isCapital: false, metroPopulation: 3600000, areaKm2: 4114, elevationM: 5},
  {name: "Abu Dhabi", countryCode: "AE", population: 1500000, lng: 54.3773, lat: 24.4539, timezone: "Asia/Dubai", isCapital: true, metroPopulation: 1500000, areaKm2: 67340, elevationM: 24},
  {name: "Berlin", countryCode: "DE", population: 3645000, lng: 13.4050, lat: 52.5200, timezone: "Europe/Berlin", isCapital: true, metroPopulation: 3645000, areaKm2: 891, elevationM: 34},
  {name: "Madrid", countryCode: "ES", population: 3280000, lng: -3.7038, lat: 40.4168, timezone: "Europe/Madrid", isCapital: true, metroPopulation: 3280000, areaKm2: 604, elevationM: 649},
  {name: "Rome", countryCode: "IT", population: 2873000, lng: 12.4964, lat: 41.9028, timezone: "Europe/Rome", isCapital: true, metroPopulation: 2873000, areaKm2: 1285, elevationM: 21},
  {name: "Amsterdam", countryCode: "NL", population: 873000, lng: 4.8952, lat: 52.3676, timezone: "Europe/Amsterdam", isCapital: true, metroPopulation: 2400000, areaKm2: 219, elevationM: -2},
  {name: "Brussels", countryCode: "BE", population: 1220000, lng: 4.3517, lat: 50.8503, timezone: "Europe/Brussels", isCapital: true, metroPopulation: 2100000, areaKm2: 161, elevationM: 15},
  {name: "Vienna", countryCode: "AT", population: 1920000, lng: 16.3738, lat: 48.2082, timezone: "Europe/Vienna", isCapital: true, metroPopulation: 2700000, areaKm2: 414, elevationM: 171},
  {name: "Prague", countryCode: "CZ", population: 1320000, lng: 14.4378, lat: 50.0755, timezone: "Europe/Prague", isCapital: true, metroPopulation: 2600000, areaKm2: 496, elevationM: 177},
  {name: "Warsaw", countryCode: "PL", population: 1863000, lng: 21.0122, lat: 52.2297, timezone: "Europe/Warsaw", isCapital: true, metroPopulation: 2300000, areaKm2: 517, elevationM: 82},
  {name: "Budapest", countryCode: "HU", population: 1752000, lng: 19.0402, lat: 47.4979, timezone: "Europe/Budapest", isCapital: true, metroPopulation: 2500000, areaKm2: 525, elevationM: 102},
  {name: "Athens", countryCode: "GR", population: 3154000, lng: 23.7275, lat: 37.9838, timezone: "Europe/Athens", isCapital: true, metroPopulation: 3200000, areaKm2: 412, elevationM: 70},
  {name: "Ankara", countryCode: "TR", population: 5500000, lng: 32.8597, lat: 39.9334, timezone: "Europe/Istanbul", isCapital: true, metroPopulation: 5500000, areaKm2: 2703, elevationM: 938},
  {name: "Toronto", countryCode: "CA", population: 6270000, lng: -79.3871, lat: 43.6629, timezone: "America/Toronto", isCapital: false, metroPopulation: 6270000, areaKm2: 630, elevationM: 76},
  {name: "Vancouver", countryCode: "CA", population: 2637000, lng: -123.1207, lat: 49.2827, timezone: "America/Vancouver", isCapital: false, metroPopulation: 2637000, areaKm2: 115, elevationM: 70},
  {name: "Montreal", countryCode: "CA", population: 4220000, lng: -73.5673, lat: 45.5017, timezone: "America/Toronto", isCapital: false, metroPopulation: 4220000, areaKm2: 365, elevationM: 57},
  {name: "Sydney", countryCode: "AU", population: 5312000, lng: 151.2093, lat: -33.8688, timezone: "Australia/Sydney", isCapital: false, metroPopulation: 5312000, areaKm2: 2058, elevationM: 58},
  {name: "Melbourne", countryCode: "AU", population: 5159000, lng: 144.9631, lat: -37.8136, timezone: "Australia/Melbourne", isCapital: false, metroPopulation: 5159000, areaKm2: 1482, elevationM: 35},
  {name: "Brisbane", countryCode: "AU", population: 2560000, lng: 153.0251, lat: -27.4698, timezone: "Australia/Brisbane", isCapital: false, metroPopulation: 2560000, areaKm2: 1146, elevationM: 24},
  {name: "Perth", countryCode: "AU", population: 2125000, lng: 115.8605, lat: -31.9505, timezone: "Australia/Perth", isCapital: false, metroPopulation: 2125000, areaKm2: 5386, elevationM: 17},
  {name: "Canberra", countryCode: "AU", population: 460000, lng: 149.1900, lat: -35.2809, timezone: "Australia/Sydney", isCapital: true, metroPopulation: 460000, areaKm2: 2359, elevationM: 599},
  {name: "Auckland", countryCode: "NZ", population: 1657000, lng: 174.8860, lat: -37.0742, timezone: "Pacific/Auckland", isCapital: false, metroPopulation: 1657000, areaKm2: 1086, elevationM: 100},
  {name: "Wellington", countryCode: "NZ", population: 418000, lng: 174.7762, lat: -41.2865, timezone: "Pacific/Auckland", isCapital: true, metroPopulation: 500000, areaKm2: 290, elevationM: 29},
  {name: "Johannesburg", countryCode: "ZA", population: 6159000, lng: 28.0473, lat: -26.2023, timezone: "Africa/Johannesburg", isCapital: false, metroPopulation: 6159000, areaKm2: 1645, elevationM: 1753},
  {name: "Cape Town", countryCode: "ZA", population: 4618000, lng: 18.4241, lat: -33.9249, timezone: "Africa/Johannesburg", isCapital: false, metroPopulation: 4618000, areaKm2: 2456, elevationM: 41},
  {name: "Pretoria", countryCode: "ZA", population: 2345000, lng: 28.1949, lat: -25.7479, timezone: "Africa/Johannesburg", isCapital: true, metroPopulation: 2345000, areaKm2: 1644, elevationM: 1338},
  {name: "Durban", countryCode: "ZA", population: 3720000, lng: 31.0292, lat: -29.8587, timezone: "Africa/Johannesburg", isCapital: false, metroPopulation: 3720000, areaKm2: 2304, elevationM: 6},
];

/** Shape of the vendored gazetteer entries (Wikidata or API-seed generated). */
interface ReferenceCity {
  id: string;
  name: string;
  countryCode: string;
  admin1: string | null;
  population: number;
  center: { lat: number; lng: number };
  timezone?: string | null;
  isCapital?: boolean;
  metroPopulation?: number | null;
  areaKm2?: number | null;
  elevationM?: number | null;
}

/** Curated list merged with the vendored gazetteer, deduped by slug. */
const ALL_CITIES: RawCity[] = (() => {
  const bySlug = new Map<string, RawCity>();
  for (const city of CITIES_DATA) bySlug.set(slugify(city.name, city.countryCode), city);
  for (const ref of cityReference as ReferenceCity[]) {
    const slug = slugify(ref.name, ref.countryCode);
    if (bySlug.has(slug)) continue;
    bySlug.set(slug, {
      name: ref.name,
      countryCode: ref.countryCode,
      population: ref.population,
      lng: ref.center.lng,
      lat: ref.center.lat,
      timezone: ref.timezone ?? 'UTC',
      isCapital: ref.isCapital ?? false,
      metroPopulation: ref.metroPopulation ?? undefined,
      areaKm2: ref.areaKm2 ?? undefined,
      elevationM: ref.elevationM ?? undefined,
      admin1: ref.admin1 ?? undefined,
    });
  }
  return [...bySlug.values()].sort((a, b) => b.population - a.population);
})();

/**
 * Get all major cities sorted by population.
 */
export async function getMajorCities(limit = 200): Promise<CityLite[]> {
  return ALL_CITIES.slice(0, limit)
    .sort((a, b) => b.population - a.population)
    .map((city) => ({
      id: slugify(city.name, city.countryCode),
      name: city.name,
      countryCode: city.countryCode,
      population: city.population,
      center: { lng: city.lng, lat: city.lat },
    }));
}

/**
 * Get detailed information about a city by ID.
 */
export async function getCityDetail(id: string): Promise<CityDetail | null> {
  const city = ALL_CITIES.find((c) => slugify(c.name, c.countryCode) === id);
  if (!city) return null;

  return {
    id: slugify(city.name, city.countryCode),
    name: city.name,
    countryCode: city.countryCode,
    population: city.population,
    center: { lng: city.lng, lat: city.lat },
    timezone: city.timezone,
    isCapital: city.isCapital,
    metroPopulation: city.metroPopulation,
    areaKm2: city.areaKm2,
    elevationM: city.elevationM,
    admin1: city.admin1,
  };
}

/**
 * Search cities by name or country code.
 */
export async function searchCities(query: string, limit = 20): Promise<CityLite[]> {
  const lowerQuery = query.toLowerCase();
  return ALL_CITIES.filter((city) => city.name.toLowerCase().includes(lowerQuery) || city.countryCode.toLowerCase().includes(lowerQuery))
    .slice(0, limit)
    .map((city) => ({
      id: slugify(city.name, city.countryCode),
      name: city.name,
      countryCode: city.countryCode,
      population: city.population,
      center: { lng: city.lng, lat: city.lat },
    }));
}

/**
 * Get cities by country code.
 */
export async function getCitiesByCountry(countryCode: string, limit = 50): Promise<CityLite[]> {
  return ALL_CITIES.filter((c) => c.countryCode === countryCode)
    .slice(0, limit)
    .map((city) => ({
      id: slugify(city.name, city.countryCode),
      name: city.name,
      countryCode: city.countryCode,
      population: city.population,
      center: { lng: city.lng, lat: city.lat },
    }));
}

/**
 * Get nearest cities to a given coordinate.
 */
export async function getNearestCities(lng: number, lat: number, limit = 10): Promise<CityLite[]> {
  const distances = ALL_CITIES.map((city) => {
    const dLng = city.lng - lng;
    const dLat = city.lat - lat;
    const distance = Math.sqrt(dLng * dLng + dLat * dLat);
    return { city, distance };
  });

  return distances
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map(({ city }) => ({
      id: slugify(city.name, city.countryCode),
      name: city.name,
      countryCode: city.countryCode,
      population: city.population,
      center: { lng: city.lng, lat: city.lat },
    }));
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
