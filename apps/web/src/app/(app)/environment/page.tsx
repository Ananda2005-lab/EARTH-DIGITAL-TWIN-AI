import {
  aqiBand,
  formatNumber,
  formatTemperature,
  POLLUTANT_LABEL,
  type AqiBand,
  type ClimateNormal,
  type Pollutant,
} from '@edt/shared';
import { Leaf, Thermometer } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { StatCard, StatCardSkeleton } from '@/components/data/stat-card';
import { PageContainer, PageHeader, Section } from '@/components/layout/page-header';
import { Badge, LiveBadge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getAirQuality, getClimate } from '@/server/providers/open-meteo';

export const metadata: Metadata = {
  title: 'Environment',
  description: 'Air quality, pollutant breakdown and climate normals for a default location.',
};

// Reads live upstream feeds, so the page is rendered per request rather than
// prerendered at build time.
export const dynamic = 'force-dynamic';

// London — hardcoded default until a location search/picker exists.
const DEFAULT_LOCATION = { lng: -0.1278, lat: 51.5074 };
const DEFAULT_TIMEZONE = 'Europe/London';

const MONTH_LABEL = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const POLLUTANTS: Pollutant[] = ['pm25', 'pm10', 'no2', 'so2', 'o3', 'co'];

/** AqiBand → StatCard intent, per the good/moderate/unhealthy/hazardous scale. */
function aqiIntent(band: AqiBand): 'positive' | 'warning' | 'negative' {
  if (band === 'good') return 'positive';
  if (band === 'moderate' || band === 'unhealthy_sensitive' || band === 'unhealthy') {
    return 'warning';
  }
  return 'negative';
}

function aqiBadgeVariant(band: AqiBand): 'success' | 'warning' | 'danger' {
  if (band === 'good') return 'success';
  if (band === 'moderate' || band === 'unhealthy_sensitive' || band === 'unhealthy') {
    return 'warning';
  }
  return 'danger';
}

export default function EnvironmentPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow={<LiveBadge />}
        title="Environment"
        description="Air quality, pollutant levels and long-term climate normals, powered by Open-Meteo and Copernicus CAMS."
      />

      <Suspense fallback={<EnvironmentSkeleton />}>
        <EnvironmentView />
      </Suspense>
    </PageContainer>
  );
}

async function EnvironmentView() {
  const [airQuality, climate] = await Promise.all([
    getAirQuality(DEFAULT_LOCATION, DEFAULT_TIMEZONE),
    getClimate(DEFAULT_LOCATION),
  ]);

  const band = aqiBand(airQuality.now.aqi);

  return (
    <>
      <Section title="Air quality now" description={airQuality.attribution}>
        <Card className="overflow-hidden p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="stat-label">Air quality index</span>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="stat-value text-4xl">{formatNumber(airQuality.now.aqi)}</span>
                <Badge variant={aqiBadgeVariant(band.band)}>{band.label}</Badge>
              </div>
              <p className="text-muted-foreground mt-2 max-w-md text-xs leading-relaxed">
                {band.advice}
              </p>
            </div>
            <div className="text-right">
              <span className="stat-label">Dominant pollutant</span>
              <p className="text-foreground mt-2 text-lg font-medium">
                {POLLUTANT_LABEL[airQuality.now.dominantPollutant]}
              </p>
            </div>
          </div>
        </Card>
      </Section>

      <Section title="Pollutant breakdown" description="Current concentrations, µg/m³ (CO in ppb).">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {POLLUTANTS.map((pollutant) => (
            <StatCard
              key={pollutant}
              label={POLLUTANT_LABEL[pollutant]}
              value={formatNumber(airQuality.now[pollutant], 1)}
              intent={
                pollutant === airQuality.now.dominantPollutant ? aqiIntent(band.band) : 'neutral'
              }
              icon={<Leaf />}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Climate"
        description={`${climate.koppenLabel ?? 'Unclassified'} · ${climate.attribution}`}
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <StatCard
            label="Warming rate"
            value={`${climate.warmingPerDecade > 0 ? '+' : ''}${formatNumber(climate.warmingPerDecade, 2)}°C`}
            unit="per decade"
            icon={<Thermometer />}
            intent={climate.warmingPerDecade > 0 ? 'warning' : 'neutral'}
          />
          <StatCard
            label="Köppen classification"
            value={climate.koppenClass ?? '—'}
            hint={climate.koppenLabel}
            icon={<Leaf />}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Monthly normals</CardTitle>
            <p className="text-muted-foreground text-xs">1991-2020 averages</p>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-border/60 border-y text-left text-xs">
                  <th className="px-5 py-2 font-medium">Month</th>
                  <th className="px-3 py-2 text-right font-medium">Mean</th>
                  <th className="px-3 py-2 text-right font-medium">Max</th>
                  <th className="px-3 py-2 text-right font-medium">Min</th>
                  <th className="px-5 py-2 text-right font-medium">Precip.</th>
                </tr>
              </thead>
              <tbody className="divide-border/60 divide-y">
                {climate.normals.map((normal) => (
                  <NormalRow key={normal.month} normal={normal} />
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </Section>
    </>
  );
}

function NormalRow({ normal }: { normal: ClimateNormal }) {
  return (
    <tr>
      <td className="px-5 py-2.5 font-medium">{MONTH_LABEL[normal.month - 1]}</td>
      <td className="numeric px-3 py-2.5 text-right">
        {formatTemperature(normal.temperatureMean)}
      </td>
      <td className="numeric px-3 py-2.5 text-right">{formatTemperature(normal.temperatureMax)}</td>
      <td className="numeric px-3 py-2.5 text-right">{formatTemperature(normal.temperatureMin)}</td>
      <td className="numeric px-5 py-2.5 text-right">{formatNumber(normal.precipitation)} mm</td>
    </tr>
  );
}

function EnvironmentSkeleton() {
  return (
    <>
      <Card className="mb-8 p-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-10 w-24" />
        <Skeleton className="mt-3 h-3 w-64" />
      </Card>
      <div className="mb-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
      <Card className="p-5">
        <Skeleton className="h-5 w-32" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </div>
      </Card>
    </>
  );
}
