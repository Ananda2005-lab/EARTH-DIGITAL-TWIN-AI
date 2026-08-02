/**
 * Curated World Bank indicator catalogue.
 *
 * Only these codes can be requested through the analytics endpoints — an
 * allow-list keeps the upstream call surface predictable and cacheable, and stops
 * arbitrary strings reaching the provider.
 */
export interface IndicatorDefinition {
  code: string;
  label: string;
  unit: string;
  /** Higher is better — drives the default ranking direction. */
  higherIsBetter: boolean;
  category: 'economy' | 'population' | 'environment' | 'society' | 'infrastructure' | 'health';
}

export const INDICATORS: readonly IndicatorDefinition[] = [
  { code: 'NY.GDP.MKTP.CD', label: 'GDP (current US$)', unit: 'US$', higherIsBetter: true, category: 'economy' },
  { code: 'NY.GDP.PCAP.CD', label: 'GDP per capita', unit: 'US$', higherIsBetter: true, category: 'economy' },
  { code: 'NY.GDP.MKTP.KD.ZG', label: 'GDP growth', unit: '%', higherIsBetter: true, category: 'economy' },
  { code: 'FP.CPI.TOTL.ZG', label: 'Inflation, consumer prices', unit: '%', higherIsBetter: false, category: 'economy' },
  { code: 'SL.UEM.TOTL.ZS', label: 'Unemployment', unit: '% of labour force', higherIsBetter: false, category: 'economy' },
  { code: 'MS.MIL.XPND.GD.ZS', label: 'Military expenditure', unit: '% of GDP', higherIsBetter: false, category: 'economy' },
  { code: 'ST.INT.ARVL', label: 'International tourist arrivals', unit: 'arrivals', higherIsBetter: true, category: 'economy' },
  { code: 'SP.POP.TOTL', label: 'Population', unit: 'people', higherIsBetter: true, category: 'population' },
  { code: 'SP.POP.GROW', label: 'Population growth', unit: '%', higherIsBetter: true, category: 'population' },
  { code: 'SP.URB.TOTL.IN.ZS', label: 'Urban population', unit: '% of total', higherIsBetter: true, category: 'population' },
  { code: 'SP.DYN.TFRT.IN', label: 'Fertility rate', unit: 'births per woman', higherIsBetter: true, category: 'population' },
  { code: 'SP.DYN.LE00.IN', label: 'Life expectancy at birth', unit: 'years', higherIsBetter: true, category: 'health' },
  { code: 'SH.XPD.CHEX.GD.ZS', label: 'Health expenditure', unit: '% of GDP', higherIsBetter: true, category: 'health' },
  { code: 'SH.DYN.MORT', label: 'Under-5 mortality', unit: 'per 1,000', higherIsBetter: false, category: 'health' },
  { code: 'SE.ADT.LITR.ZS', label: 'Adult literacy', unit: '%', higherIsBetter: true, category: 'society' },
  { code: 'SE.XPD.TOTL.GD.ZS', label: 'Education expenditure', unit: '% of GDP', higherIsBetter: true, category: 'society' },
  { code: 'IT.NET.USER.ZS', label: 'Internet users', unit: '% of population', higherIsBetter: true, category: 'infrastructure' },
  { code: 'EG.ELC.ACCS.ZS', label: 'Access to electricity', unit: '% of population', higherIsBetter: true, category: 'infrastructure' },
  { code: 'EN.GHG.CO2.PC.CE.AR5', label: 'CO₂ emissions per capita', unit: 't', higherIsBetter: false, category: 'environment' },
  { code: 'EG.FEC.RNEW.ZS', label: 'Renewable energy share', unit: '% of final energy', higherIsBetter: true, category: 'environment' },
  { code: 'AG.LND.FRST.ZS', label: 'Forest area', unit: '% of land', higherIsBetter: true, category: 'environment' },
  { code: 'ER.LND.PTLD.ZS', label: 'Terrestrial protected areas', unit: '% of land', higherIsBetter: true, category: 'environment' },
  { code: 'ER.H2O.FWTL.ZS', label: 'Freshwater withdrawal', unit: '% of resources', higherIsBetter: false, category: 'environment' },
] as const;

const BY_CODE = new Map(INDICATORS.map((indicator) => [indicator.code, indicator]));

export function findIndicator(code: string): IndicatorDefinition | undefined {
  return BY_CODE.get(code.trim().toUpperCase());
}

export function isKnownIndicator(code: string): boolean {
  return BY_CODE.has(code.trim().toUpperCase());
}

/** Indicators mirrored onto `CountryDetail` fields. */
export const COUNTRY_DETAIL_INDICATORS = {
  'NY.GDP.MKTP.CD': 'gdpUsd',
  'NY.GDP.PCAP.CD': 'gdpPerCapitaUsd',
  'NY.GDP.MKTP.KD.ZG': 'gdpGrowthPct',
  'SP.DYN.LE00.IN': 'lifeExpectancy',
  'SP.URB.TOTL.IN.ZS': 'urbanPopulationPct',
  'SE.ADT.LITR.ZS': 'literacyPct',
  'IT.NET.USER.ZS': 'internetUsersPct',
  'EN.GHG.CO2.PC.CE.AR5': 'co2TonnesPerCapita',
  'EG.FEC.RNEW.ZS': 'renewableEnergyPct',
  'AG.LND.FRST.ZS': 'forestAreaPct',
  'SP.DYN.TFRT.IN': 'fertilityRate',
  'SL.UEM.TOTL.ZS': 'unemploymentPct',
  'FP.CPI.TOTL.ZG': 'inflationPct',
  'MS.MIL.XPND.GD.ZS': 'militaryExpenditurePctGdp',
  'ST.INT.ARVL': 'touristArrivals',
} as const;

export type CountryDetailIndicatorField = (typeof COUNTRY_DETAIL_INDICATORS)[keyof typeof COUNTRY_DETAIL_INDICATORS];
