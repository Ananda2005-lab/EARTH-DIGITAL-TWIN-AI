import type { CountryDetail, CountrySummary, IndicatorSeries } from '@edt/shared';
import { buildUrl, fetchUpstream } from '../http';
import { cached, cacheKey } from '../cache';
import { COUNTRIES, countryByCode, countrySummary, flagSvgUrl } from '@/lib/data/countries';

const WORLD_BANK = 'https://api.worldbank.org/v2';

/**
 * Country facts come from the vendored reference dataset (instant, offline-safe)
 * while every economic/social/environmental metric is fetched live from the World
 * Bank so the profiles never go stale.
 */
export async function getAllCountries(): Promise<CountrySummary[]> {
  return COUNTRIES.map(countrySummary);
}

const INDICATORS = {
  gdpUsd: 'NY.GDP.MKTP.CD',
  gdpPerCapitaUsd: 'NY.GDP.PCAP.CD',
  gdpGrowthPct: 'NY.GDP.MKTP.KD.ZG',
  lifeExpectancy: 'SP.DYN.LE00.IN',
  urbanPopulationPct: 'SP.URB.TOTL.IN.ZS',
  literacyPct: 'SE.ADT.LITR.ZS',
  internetUsersPct: 'IT.NET.USER.ZS',
  co2TonnesPerCapita: 'EN.GHG.CO2.PC.CE.AR5',
  renewableEnergyPct: 'EG.FEC.RNEW.ZS',
  forestAreaPct: 'AG.LND.FRST.ZS',
  fertilityRate: 'SP.DYN.TFRT.IN',
  unemploymentPct: 'SL.UEM.TOTL.ZS',
  inflationPct: 'FP.CPI.TOTL.ZG',
  militaryExpenditurePctGdp: 'MS.MIL.XPND.GD.ZS',
  touristArrivals: 'ST.INT.ARVL',
  population: 'SP.POP.TOTL',
} as const;

type IndicatorKey = keyof typeof INDICATORS;

interface WorldBankPoint {
  indicator: { id: string; value: string };
  country: { id: string; value: string };
  countryiso3code: string;
  date: string;
  value: number | null;
}

type WorldBankResponse = [
  { page: number; pages: number; total: number } | null,
  WorldBankPoint[] | null,
];

/** World Bank aggregates (regions, income groups) that must never appear in rankings. */
const AGGREGATE_CODES = new Set([
  'WLD',
  'EUU',
  'ARB',
  'OED',
  'LCN',
  'EAS',
  'ECS',
  'MEA',
  'NAC',
  'SAS',
  'SSF',
  'EMU',
  'CEB',
  'TEA',
  'TEC',
  'TLA',
  'TMN',
  'TSA',
  'TSS',
  'IBD',
  'IBT',
  'IDA',
  'IDB',
  'IDX',
  'LMY',
  'LIC',
  'LMC',
  'MIC',
  'UMC',
  'HIC',
  'PST',
  'PRE',
  'SST',
  'FCS',
  'HPC',
  'LDC',
  'LTE',
  'AFE',
  'AFW',
  'EAP',
  'ECA',
  'SSA',
  'INX',
  'OSS',
  'MNA',
  'CSS',
  'EAR',
  'EUC',
]);

async function getLatestIndicator(
  countryCode3: string,
  indicator: string,
): Promise<{ value: number; year: number } | null> {
  const key = cacheKey('worldbank:latest', { countryCode3, indicator });
  return cached(key, 86_400, async () => {
    const url = buildUrl(`${WORLD_BANK}/country/${countryCode3}/indicator/${indicator}`, {
      format: 'json',
      per_page: 5,
      mrnev: 1,
    });
    try {
      const raw = await fetchUpstream<WorldBankResponse>(url, {
        provider: 'World Bank',
        revalidate: 86_400,
        retries: 1,
      });
      const point = (raw?.[1] ?? []).find((p) => p.value !== null);
      if (!point || point.value === null) return null;
      return { value: point.value, year: Number(point.date) };
    } catch {
      return null;
    }
  });
}

export async function getIndicatorSeries(
  countryCodes: string[],
  indicator: string,
  from = 1990,
  to = new Date().getUTCFullYear(),
): Promise<Record<string, IndicatorSeries>> {
  const codes = countryCodes
    .map((code) => countryByCode(code)?.code3 ?? code.toUpperCase())
    .filter(Boolean)
    .slice(0, 40);
  if (codes.length === 0) return {};
  const key = cacheKey('worldbank:series', { codes: codes.join('|'), indicator, from, to });
  return cached(key, 86_400, async () => {
    const url = buildUrl(`${WORLD_BANK}/country/${codes.join(';')}/indicator/${indicator}`, {
      format: 'json',
      per_page: 20_000,
      date: `${from}:${to}`,
    });
    const raw = await fetchUpstream<WorldBankResponse>(url, {
      provider: 'World Bank',
      revalidate: 86_400,
    });
    const out: Record<string, IndicatorSeries> = {};
    for (const point of raw?.[1] ?? []) {
      if (point.value === null) continue;
      const code = countryByCode(point.countryiso3code)?.code ?? point.country.id;
      out[code] ??= {
        indicator,
        label: point.indicator.value,
        unit: inferUnit(point.indicator.value),
        source: 'World Bank Open Data',
        points: [],
      };
      out[code]!.points.push({ year: Number(point.date), value: point.value });
    }
    for (const series of Object.values(out)) series.points.sort((a, b) => a.year - b.year);
    return out;
  });
}

function inferUnit(label: string): string {
  if (/\(%\)|% of|%\)/.test(label)) return '%';
  if (/current US\$/i.test(label)) return 'USD';
  if (/years/i.test(label)) return 'years';
  if (/metric tons|tonnes|tCO2/i.test(label)) return 't';
  if (/per woman|births/i.test(label)) return 'births';
  return '';
}

export const INDICATOR_CATALOGUE: readonly {
  id: string;
  label: string;
  unit: string;
  category: string;
  higherIsBetter: boolean;
  description: string;
}[] = [
  {
    id: 'NY.GDP.MKTP.CD',
    label: 'GDP (nominal)',
    unit: 'USD',
    category: 'Economy',
    higherIsBetter: true,
    description: 'Gross domestic product at current market prices.',
  },
  {
    id: 'NY.GDP.PCAP.CD',
    label: 'GDP per capita',
    unit: 'USD',
    category: 'Economy',
    higherIsBetter: true,
    description: 'Nominal output divided by mid-year population.',
  },
  {
    id: 'NY.GDP.PCAP.PP.CD',
    label: 'GDP per capita (PPP)',
    unit: 'USD',
    category: 'Economy',
    higherIsBetter: true,
    description: 'Purchasing-power adjusted output per person.',
  },
  {
    id: 'NY.GDP.MKTP.KD.ZG',
    label: 'GDP growth',
    unit: '%',
    category: 'Economy',
    higherIsBetter: true,
    description: 'Annual percentage growth of real GDP.',
  },
  {
    id: 'FP.CPI.TOTL.ZG',
    label: 'Inflation (CPI)',
    unit: '%',
    category: 'Economy',
    higherIsBetter: false,
    description: 'Annual change in consumer prices.',
  },
  {
    id: 'SL.UEM.TOTL.ZS',
    label: 'Unemployment',
    unit: '%',
    category: 'Economy',
    higherIsBetter: false,
    description: 'Share of the labour force without work but seeking employment.',
  },
  {
    id: 'NE.EXP.GNFS.ZS',
    label: 'Exports',
    unit: '% of GDP',
    category: 'Economy',
    higherIsBetter: true,
    description: 'Exports of goods and services as a share of GDP.',
  },
  {
    id: 'SP.POP.TOTL',
    label: 'Population',
    unit: 'people',
    category: 'Population',
    higherIsBetter: true,
    description: 'Total mid-year resident population.',
  },
  {
    id: 'SP.POP.GROW',
    label: 'Population growth',
    unit: '%',
    category: 'Population',
    higherIsBetter: true,
    description: 'Annual exponential population growth rate.',
  },
  {
    id: 'SP.URB.TOTL.IN.ZS',
    label: 'Urban population',
    unit: '%',
    category: 'Population',
    higherIsBetter: true,
    description: 'Share of people living in urban agglomerations.',
  },
  {
    id: 'SP.DYN.TFRT.IN',
    label: 'Fertility rate',
    unit: 'births',
    category: 'Population',
    higherIsBetter: true,
    description: 'Births per woman over a lifetime at current rates.',
  },
  {
    id: 'SP.DYN.LE00.IN',
    label: 'Life expectancy',
    unit: 'years',
    category: 'Health',
    higherIsBetter: true,
    description: 'Life expectancy at birth, both sexes.',
  },
  {
    id: 'SH.DYN.MORT',
    label: 'Under-5 mortality',
    unit: 'per 1,000',
    category: 'Health',
    higherIsBetter: false,
    description: 'Probability of dying before age five per 1,000 live births.',
  },
  {
    id: 'SH.XPD.CHEX.GD.ZS',
    label: 'Health expenditure',
    unit: '% of GDP',
    category: 'Health',
    higherIsBetter: true,
    description: 'Current health spending as a share of GDP.',
  },
  {
    id: 'SE.ADT.LITR.ZS',
    label: 'Literacy rate',
    unit: '%',
    category: 'Society',
    higherIsBetter: true,
    description: 'Adults aged 15+ who can read and write.',
  },
  {
    id: 'SE.XPD.TOTL.GD.ZS',
    label: 'Education expenditure',
    unit: '% of GDP',
    category: 'Society',
    higherIsBetter: true,
    description: 'Government spending on education as a share of GDP.',
  },
  {
    id: 'IT.NET.USER.ZS',
    label: 'Internet users',
    unit: '%',
    category: 'Society',
    higherIsBetter: true,
    description: 'Individuals using the internet in the last three months.',
  },
  {
    id: 'EN.GHG.CO2.PC.CE.AR5',
    label: 'CO₂ per capita',
    unit: 't',
    category: 'Environment',
    higherIsBetter: false,
    description: 'Carbon dioxide emissions per person, excluding land use.',
  },
  {
    id: 'EG.FEC.RNEW.ZS',
    label: 'Renewable energy share',
    unit: '%',
    category: 'Environment',
    higherIsBetter: true,
    description: 'Renewables as a share of total final energy consumption.',
  },
  {
    id: 'AG.LND.FRST.ZS',
    label: 'Forest area',
    unit: '%',
    category: 'Environment',
    higherIsBetter: true,
    description: 'Land under natural or planted forest stands.',
  },
  {
    id: 'ER.H2O.FWTL.ZS',
    label: 'Freshwater withdrawal',
    unit: '% of resources',
    category: 'Environment',
    higherIsBetter: false,
    description: 'Annual freshwater withdrawals against internal resources.',
  },
  {
    id: 'EG.ELC.ACCS.ZS',
    label: 'Access to electricity',
    unit: '%',
    category: 'Infrastructure',
    higherIsBetter: true,
    description: 'Population with access to electricity.',
  },
  {
    id: 'IS.AIR.PSGR',
    label: 'Air passengers carried',
    unit: 'passengers',
    category: 'Infrastructure',
    higherIsBetter: true,
    description: 'Domestic and international passengers on registered carriers.',
  },
  {
    id: 'ST.INT.ARVL',
    label: 'Tourist arrivals',
    unit: 'arrivals',
    category: 'Tourism',
    higherIsBetter: true,
    description: 'International inbound overnight visitors.',
  },
  {
    id: 'ST.INT.RCPT.CD',
    label: 'Tourism receipts',
    unit: 'USD',
    category: 'Tourism',
    higherIsBetter: true,
    description: 'International tourism receipts including transport.',
  },
  {
    id: 'MS.MIL.XPND.GD.ZS',
    label: 'Military expenditure',
    unit: '% of GDP',
    category: 'Governance',
    higherIsBetter: false,
    description: 'Defence spending as a share of GDP.',
  },
  {
    id: 'IC.BUS.EASE.XQ',
    label: 'Ease of doing business',
    unit: 'rank',
    category: 'Governance',
    higherIsBetter: false,
    description: 'Composite regulatory environment ranking.',
  },
] as const;

export function findIndicator(id: string) {
  return INDICATOR_CATALOGUE.find((indicator) => indicator.id === id);
}

export async function getCountry(code: string): Promise<CountryDetail | null> {
  const reference = countryByCode(code);
  if (!reference) return null;

  const key = cacheKey('country:detail', { code: reference.code });
  return cached(key, 21_600, async () => {
    const entries = Object.entries(INDICATORS) as [IndicatorKey, string][];
    const results = await Promise.all(
      entries.map(async ([field, indicator]) => {
        const value = await getLatestIndicator(reference.code3, indicator);
        return [field, value?.value ?? null] as const;
      }),
    );
    const metrics = Object.fromEntries(results) as Record<IndicatorKey, number | null>;
    const population = metrics.population ?? reference.population;

    return {
      ...countrySummary(reference),
      population,
      currencies: reference.currencies,
      languages: reference.languages,
      timezones: [],
      callingCodes: reference.callingCodes,
      tld: reference.tld,
      drivingSide: null,
      independent: reference.independent,
      unMember: reference.unMember,
      landlocked: reference.landlocked,
      borders: reference.borders,
      gdpUsd: metrics.gdpUsd,
      gdpPerCapitaUsd: metrics.gdpPerCapitaUsd,
      gdpGrowthPct: metrics.gdpGrowthPct,
      lifeExpectancy: metrics.lifeExpectancy,
      hdi: estimateHdi(metrics),
      urbanPopulationPct: metrics.urbanPopulationPct,
      literacyPct: metrics.literacyPct,
      internetUsersPct: metrics.internetUsersPct,
      co2TonnesPerCapita: metrics.co2TonnesPerCapita,
      renewableEnergyPct: metrics.renewableEnergyPct,
      forestAreaPct: metrics.forestAreaPct,
      populationDensity: reference.areaKm2 > 0 ? +(population / reference.areaKm2).toFixed(1) : 0,
      medianAge: null,
      fertilityRate: metrics.fertilityRate,
      unemploymentPct: metrics.unemploymentPct,
      inflationPct: metrics.inflationPct,
      militaryExpenditurePctGdp: metrics.militaryExpenditurePctGdp,
      touristArrivals: metrics.touristArrivals,
      flagSvgUrl: flagSvgUrl(reference.code),
      coatOfArmsUrl: null,
      mapsUrl: `https://www.openstreetmap.org/?mlat=${reference.center.lat}&mlon=${reference.center.lng}#map=5/${reference.center.lat}/${reference.center.lng}`,
      wikipediaUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(reference.name.replace(/ /g, '_'))}`,
      updatedAt: new Date().toISOString(),
    } satisfies CountryDetail;
  });
}

/**
 * HDI proxy. UNDP's index is not openly queryable, so we reconstruct it from the
 * published dimension-index formulation using life expectancy, a literacy-based
 * education proxy and log income. Surfaced in the UI as an estimate.
 */
function estimateHdi(metrics: Record<IndicatorKey, number | null>): number | null {
  const { lifeExpectancy, literacyPct, gdpPerCapitaUsd } = metrics;
  if (lifeExpectancy === null || gdpPerCapitaUsd === null) return null;
  const health = clamp01((lifeExpectancy - 20) / (85 - 20));
  const education = literacyPct === null ? 0.6 : clamp01(literacyPct / 100);
  const income = clamp01(
    (Math.log(Math.max(gdpPerCapitaUsd, 100)) - Math.log(100)) / (Math.log(75_000) - Math.log(100)),
  );
  return +Math.cbrt(health * education * income).toFixed(3);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export interface WikiSummary {
  title: string;
  extract: string;
  thumbnail: string | null;
  url: string;
}

export async function getWikipediaSummary(title: string): Promise<WikiSummary | null> {
  const key = cacheKey('wikipedia:summary', { title });
  return cached(key, 86_400, async () => {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`;
    try {
      const raw = await fetchUpstream<{
        title: string;
        extract: string;
        thumbnail?: { source: string };
        content_urls?: { desktop?: { page?: string } };
      } | null>(url, {
        provider: 'Wikipedia',
        revalidate: 86_400,
        retries: 1,
        allowNotFound: true,
      });
      if (!raw?.extract) return null;
      return {
        title: raw.title,
        extract: raw.extract,
        thumbnail: raw.thumbnail?.source ?? null,
        url:
          raw.content_urls?.desktop?.page ??
          `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      };
    } catch {
      return null;
    }
  });
}

export interface RankingRow {
  code: string;
  code3: string;
  name: string;
  flagEmoji: string;
  continent: string;
  value: number;
  year: number;
}

export async function getRanking(
  indicator: string,
  direction: 'asc' | 'desc' = 'desc',
  limit = 20,
  continent?: string,
  timeoutMs?: number,
): Promise<RankingRow[]> {
  const key = cacheKey('worldbank:ranking', { indicator, direction, limit, continent });
  return cached(key, 86_400, async () => {
    const url = buildUrl(`${WORLD_BANK}/country/all/indicator/${indicator}`, {
      format: 'json',
      per_page: 20_000,
      mrnev: 1,
    });
    const raw = await fetchUpstream<WorldBankResponse>(url, {
      provider: 'World Bank',
      revalidate: 86_400,
      timeoutMs,
      retries: timeoutMs ? 0 : 2,
    });
    return (raw?.[1] ?? [])
      .filter(
        (p) => p.value !== null && p.countryiso3code && !AGGREGATE_CODES.has(p.countryiso3code),
      )
      .map((p) => {
        const reference = countryByCode(p.countryiso3code);
        return {
          code: reference?.code ?? p.country.id,
          code3: p.countryiso3code,
          name: reference?.name ?? p.country.value,
          flagEmoji: reference?.flagEmoji ?? '🏳️',
          continent: reference?.continent ?? 'Asia',
          value: p.value as number,
          year: Number(p.date),
        } satisfies RankingRow;
      })
      .filter((row) => !continent || row.continent === continent)
      .sort((a, b) => (direction === 'desc' ? b.value - a.value : a.value - b.value))
      .slice(0, limit);
  });
}

/** Scatter data for the correlation explorer: two indicators joined by country. */
export async function getCorrelation(x: string, y: string, continent?: string, timeoutMs?: number) {
  const key = cacheKey('worldbank:correlation', { x, y, continent });
  return cached(key, 86_400, async () => {
    const [xs, ys] = await Promise.all([
      getRanking(x, 'desc', 250, continent, timeoutMs),
      getRanking(y, 'desc', 250, continent, timeoutMs),
    ]);
    const yByCode = new Map(ys.map((row) => [row.code, row]));
    return xs
      .map((row) => {
        const match = yByCode.get(row.code);
        if (!match) return null;
        return {
          code: row.code,
          name: row.name,
          flagEmoji: row.flagEmoji,
          continent: row.continent,
          x: row.value,
          y: match.value,
          xYear: row.year,
          yYear: match.year,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  });
}
