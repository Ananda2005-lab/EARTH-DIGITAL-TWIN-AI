/**
 * Generates the vendored city gazetteer.
 *
 *   apps/web/src/lib/data/city-reference.json
 *
 * Source: Wikidata SPARQL — every human settlement with a population above the
 * threshold, plus coordinates, country, admin area and elevation. Wikidata is
 * key-less, versioned and CC0, which makes it safe to vendor.
 *
 * Run: `node scripts/build-city-index.mjs [minPopulation]`
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const MIN_POPULATION = Number(process.argv[2] ?? 250_000);
const OUT = resolve('apps/web/src/lib/data/city-reference.json');
const ENDPOINT = 'https://query.wikidata.org/sparql';

/**
 * Direct `wdt:P31` matches only — the transitive `P279*` closure over settlement
 * subclasses reliably exceeds Wikidata's 60 s query budget. The explicit class
 * list below covers cities, big cities, towns, municipalities and metropolises,
 * which is everything above the population threshold we care about.
 */
const SETTLEMENT_CLASSES = [
  'wd:Q515', // city
  'wd:Q1549591', // big city
  'wd:Q3957', // town
  'wd:Q15284', // municipality
  'wd:Q1637706', // city with millions of inhabitants
  'wd:Q200250', // metropolis
  'wd:Q1093829', // city in the United States
  'wd:Q2039348', // urban municipality
];

const query = `
SELECT ?city ?cityLabel ?countryCode ?population ?coord WHERE {
  VALUES ?class { ${SETTLEMENT_CLASSES.join(' ')} }
  ?city wdt:P31 ?class ;
        wdt:P1082 ?population ;
        wdt:P625 ?coord ;
        wdt:P17 ?country .
  FILTER(?population >= ${MIN_POPULATION})
  ?country wdt:P297 ?countryCode .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?population)
LIMIT 8000
`;

function parsePoint(literal) {
  const match = /Point\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/.exec(literal ?? '');
  if (!match) return null;
  return { lng: Number(match[1]), lat: Number(match[2]) };
}

console.log(`Querying Wikidata for settlements >= ${MIN_POPULATION.toLocaleString()} people…`);

const response = await fetch(`${ENDPOINT}?query=${encodeURIComponent(query)}&format=json`, {
  headers: {
    accept: 'application/sparql-results+json',
    'user-agent': 'EarthDigitalTwin/1.0 (build script; contact support@earthdigitaltwin.ai)',
  },
});

if (!response.ok) {
  throw new Error(`Wikidata responded ${response.status}: ${(await response.text()).slice(0, 300)}`);
}

const payload = await response.json();
const rows = payload.results?.bindings ?? [];
console.log(`  ${rows.length} raw bindings`);

/** Keep the highest-population binding per Wikidata entity. */
const byId = new Map();
for (const row of rows) {
  const id = row.city?.value?.split('/').pop();
  const name = row.cityLabel?.value;
  const code = row.countryCode?.value?.toUpperCase();
  const center = parsePoint(row.coord?.value);
  const population = Number(row.population?.value ?? 0);
  if (!id || !name || !code || !center || !Number.isFinite(population)) continue;
  if (/^Q\d+$/.test(name)) continue; // unlabelled entity
  const existing = byId.get(id);
  if (existing && existing.population >= population) continue;
  byId.set(id, {
    id,
    name,
    countryCode: code,
    admin1: row.adminLabel?.value && !/^Q\d+$/.test(row.adminLabel.value) ? row.adminLabel.value : null,
    population,
    center: { lat: +center.lat.toFixed(4), lng: +center.lng.toFixed(4) },
  });
}

const cities = [...byId.values()].sort((a, b) => b.population - a.population);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(cities)}\n`);

const countries = new Set(cities.map((c) => c.countryCode)).size;
console.log(`Wrote ${cities.length} cities across ${countries} countries -> ${OUT}`);
