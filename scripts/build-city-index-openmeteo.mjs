/**
 * Fallback city gazetteer builder (keyless).
 *
 * Primary source for `city-reference.json` is Wikidata SPARQL
 * (`build-city-index.mjs`), but the endpoint is frequently rate-limited or
 * timing out. This builder falls back to the Open-Meteo geocoding API — the
 * same keyless source the cities API attributes — and emits the exact same
 * file shape so the Prisma seed consumes it identically:
 *
 *   apps/web/src/lib/data/city-reference.json
 *
 * It derives one entry per capital city from the vendored country reference,
 * which keeps the file deterministic and bounded (~200 entries).
 *
 * Run: `node scripts/build-city-index-openmeteo.mjs`
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const DATA_DIR = resolve('apps/web/src/lib/data');
const COUNTRY_FILE = join(DATA_DIR, 'country-reference.json');
const OUT = join(DATA_DIR, 'city-reference.json');
const ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';
const CONCURRENCY = 8;
const REQUEST_TIMEOUT_MS = 8000;

async function geocode(name, countryCode) {
  const url = `${ENDPOINT}?name=${encodeURIComponent(name)}&country_code=${countryCode}&count=1&language=en&format=json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': 'EarthDigitalTwin/1.0 (build script)' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload.results?.[0] ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function run() {
  const countries = JSON.parse(readFileSync(COUNTRY_FILE, 'utf8'));
  const entries = countries
    .filter((country) => country.capital && country.capitalCenter)
    .map((country) => ({
      name: country.capital,
      countryCode: country.code,
      center: country.capitalCenter,
    }));

  console.log(`Resolving ${entries.length} capital cities via Open-Meteo geocoding…`);

  const cities = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < entries.length) {
      const index = cursor;
      cursor += 1;
      const entry = entries[index];
      const result = await geocode(entry.name, entry.countryCode);
      const population = result?.population && result.population > 0 ? result.population : 0;
      cities.push({
        name: entry.name,
        asciiName: entry.name
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/gu, ''),
        countryCode: entry.countryCode,
        admin1: result?.admin1 ?? null,
        population,
        center: entry.center,
        lng: entry.center.lng,
        lat: entry.center.lat,
        elevationM: result?.elevation ?? null,
        timezone: result?.timezone ?? 'UTC',
        isCapital: true,
      });
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, entries.length) }, worker));

  cities.sort((a, b) => b.population - a.population);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(cities)}\n`);

  const withPopulation = cities.filter((city) => city.population > 0).length;
  console.log(`Wrote ${cities.length} cities (${withPopulation} with population) -> ${OUT}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
