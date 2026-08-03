import { formatCompact, NAV_ITEMS, type CountrySummary } from '@edt/shared';
import type { Metadata } from 'next';

import type { CountryLite } from '@/components/data/analytics-types';
import { CorrelationExplorer } from '@/components/data/correlation-explorer';
import { RankingExplorer } from '@/components/data/ranking-explorer';
import { PageContainer, PageHeader, Section } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import {
  findIndicator,
  getAllCountries,
  getCorrelation,
  getRanking,
  INDICATOR_CATALOGUE,
} from '@/server/providers/countries';

export const metadata: Metadata = {
  title: 'Analytics',
  description:
    'Cross-country indicators, correlations and rankings sourced from World Bank Open Data.',
};

// Rankings and correlations are fetched live from the World Bank on every
// request (behind the process-local cache), so the page renders per request.
export const dynamic = 'force-dynamic';

const DEFAULT_INDICATOR = 'NY.GDP.PCAP.CD';
const CORRELATION_X = 'NY.GDP.PCAP.CD';
const CORRELATION_Y = 'SP.DYN.LE00.IN';

function toCountryLite(country: CountrySummary): CountryLite {
  return {
    code: country.code,
    name: country.name,
    population: country.population,
    areaKm2: country.areaKm2,
    continent: country.continent,
  };
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: { indicator?: string; direction?: string };
}) {
  const indicatorId =
    (searchParams.indicator && findIndicator(searchParams.indicator)?.id) ?? DEFAULT_INDICATOR;
  const direction = searchParams.direction === 'asc' ? 'asc' : 'desc';

  const [countries, ranking, correlation] = await Promise.all([
    getAllCountries(),
    getRanking(indicatorId, direction, 15),
    getCorrelation(CORRELATION_X, CORRELATION_Y),
  ]);

  const analyticsNav = NAV_ITEMS.find((item) => item.id === 'analytics');
  const indicator = findIndicator(indicatorId);
  const xIndicator = findIndicator(CORRELATION_X);
  const yIndicator = findIndicator(CORRELATION_Y);

  return (
    <PageContainer>
      <PageHeader
        eyebrow={<Badge variant="primary">{formatCompact(countries.length)} territories</Badge>}
        title="Analytics"
        description={
          analyticsNav?.description ??
          'Cross-country indicators, correlations and rankings across every territory on Earth.'
        }
      />

      <Section
        title="Rankings explorer"
        description="Top 15 territories for any World Bank indicator, most recent year reported."
      >
        <RankingExplorer
          countries={countries.map(toCountryLite)}
          catalogue={INDICATOR_CATALOGUE}
          indicator={indicator ?? INDICATOR_CATALOGUE[0]!}
          direction={direction}
          rows={ranking}
        />
      </Section>

      <Section
        title="Correlation explorer"
        description={`${xIndicator?.label ?? CORRELATION_X} against ${yIndicator?.label ?? CORRELATION_Y}, one point per territory.`}
      >
        <CorrelationExplorer
          rows={correlation}
          xLabel={xIndicator?.label ?? CORRELATION_X}
          yLabel={yIndicator?.label ?? CORRELATION_Y}
          xUnit={xIndicator?.unit ?? ''}
          yUnit={yIndicator?.unit ?? ''}
        />
      </Section>
    </PageContainer>
  );
}
