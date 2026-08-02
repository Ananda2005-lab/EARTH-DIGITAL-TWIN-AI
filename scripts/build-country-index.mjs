/**
 * Generates the vendored country reference dataset.
 *
 *   apps/web/src/lib/data/country-reference.json
 *
 * Why vendored: the globe renders Natural Earth TopoJSON keyed by numeric ISO
 * 3166-1 codes while the rest of the platform keys off alpha-2, and we need that
 * crosswalk plus stable facts (currencies, languages, borders, calling codes)
 * available synchronously, offline, and without a third-party API key.
 *
 * Sources
 *   - mledoze/countries  — ISO codes, names, currencies, languages, borders (ODbL 1.0)
 *   - World Bank API     — capital coordinates, region, income group
 *   - World Bank API     — latest population (SP.POP.TOTL) and land area (AG.SRF.TOTL.K2)
 *
 * Run: `node scripts/build-country-index.mjs`
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const OUT = resolve('apps/web/src/lib/data/country-reference.json');

const MLEDOZE = 'https://cdn.jsdelivr.net/gh/mledoze/countries@master/countries.json';
const WB_COUNTRIES = 'https://api.worldbank.org/v2/country?format=json&per_page=400';
const WB_POPULATION =
  'https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&per_page=20000&mrnev=1';
/** Total area comes from mledoze (ISO/UN figures); the World Bank only publishes
 *  land area, which excludes inland water and would disagree with the atlas. */

const SOUTH_AMERICA = new Set([
  'AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'FK', 'GF', 'GY', 'PE', 'PY', 'SR', 'UY', 'VE', 'GS',
]);

const CONTINENT = {
  Africa: 'Africa',
  Asia: 'Asia',
  Europe: 'Europe',
  Oceania: 'Oceania',
  Antarctic: 'Antarctica',
};

async function json(url, label, { required = true } = {}) {
  try {
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`${label} responded ${response.status}`);
    return await response.json();
  } catch (error) {
    if (required) throw error;
    console.warn(`  optional source unavailable (${label}): ${error.message}`);
    return null;
  }
}

function flagEmoji(code) {
  if (!/^[A-Za-z]{2}$/.test(code)) return '\u{1F3F3}\u{FE0F}';
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split('')
      .map((char) => 0x1f1e6 + char.charCodeAt(0) - 65),
  );
}

function indexLatest(payload) {
  const map = new Map();
  for (const point of payload?.[1] ?? []) {
    if (point.value === null || !point.countryiso3code) continue;
    const existing = map.get(point.countryiso3code);
    if (!existing || Number(point.date) > existing.year) {
      map.set(point.countryiso3code, { value: point.value, year: Number(point.date) });
    }
  }
  return map;
}

console.log('Fetching source datasets…');
const [mledoze, wbCountries, wbPopulation] = await Promise.all([
  json(MLEDOZE, 'mledoze/countries'),
  json(WB_COUNTRIES, 'World Bank countries'),
  json(WB_POPULATION, 'World Bank population', { required: false }),
]);

const wbByIso2 = new Map();
for (const entry of wbCountries[1] ?? []) {
  if (!entry.iso2Code) continue;
  wbByIso2.set(entry.iso2Code.toUpperCase(), entry);
}

const population = indexLatest(wbPopulation);

const records = mledoze
  .filter((c) => c?.cca2 && c?.name?.common)
  .map((c) => {
    const wb = wbByIso2.get(c.cca2.toUpperCase());
    const wbLat = wb?.latitude ? Number(wb.latitude) : null;
    const wbLng = wb?.longitude ? Number(wb.longitude) : null;
    const pop = population.get(c.cca3);
    return {
      numeric: c.ccn3 ?? null,
      code: c.cca2.toUpperCase(),
      code3: c.cca3,
      name: c.name.common,
      officialName: c.name.official ?? c.name.common,
      continent:
        c.region === 'Americas'
          ? SOUTH_AMERICA.has(c.cca2.toUpperCase())
            ? 'South America'
            : 'North America'
          : (CONTINENT[c.region] ?? 'Asia'),
      region: c.region ?? null,
      subregion: c.subregion ?? null,
      capital: c.capital?.[0] ?? wb?.capitalCity ?? null,
      capitalCenter:
        Number.isFinite(wbLat) && Number.isFinite(wbLng) && (wbLat !== 0 || wbLng !== 0)
          ? { lat: wbLat, lng: wbLng }
          : null,
      center: { lat: c.latlng?.[0] ?? 0, lng: c.latlng?.[1] ?? 0 },
      population: pop?.value ?? 0,
      populationYear: pop?.year ?? null,
      areaKm2: c.area ?? 0,
      flagEmoji: c.flag ?? flagEmoji(c.cca2),
      currencies: Object.entries(c.currencies ?? {}).map(([code, value]) => ({
        code,
        name: value?.name ?? code,
        symbol: value?.symbol ?? null,
      })),
      languages: Object.entries(c.languages ?? {}).map(([code, name]) => ({ code, name })),
      callingCodes: (c.idd?.suffixes ?? [])
        .slice(0, 4)
        .map((suffix) => `${c.idd?.root ?? ''}${suffix}`),
      tld: c.tld ?? [],
      independent: Boolean(c.independent),
      unMember: Boolean(c.unMember),
      landlocked: Boolean(c.landlocked),
      borders: c.borders ?? [],
      demonym: c.demonyms?.eng?.m ?? null,
      incomeGroup: wb?.incomeLevel?.value?.trim() ?? null,
      altSpellings: (c.altSpellings ?? []).slice(0, 6),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const withPopulation = records.filter((r) => r.population > 0).length;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(records)}\n`);

console.log(`Wrote ${records.length} countries (${withPopulation} with population) -> ${OUT}`);
