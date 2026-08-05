import {
  beaufortFor,
  formatArea,
  formatCompact,
  formatNumber,
  formatPercent,
  formatTemperature,
  type WeatherCondition,
} from '@edt/shared';
import {
  ArrowUpRight,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  Droplets,
  ExternalLink,
  MapPin,
  Snowflake,
  Sun,
  Thermometer,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { StatCard } from '@/components/data/stat-card';
import { PageContainer, PageHeader, Section } from '@/components/layout/page-header';
import { MapEmbed } from '@/components/map/map-embed';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { countryByCode, flagUrl, type CountryReference } from '@/lib/data/countries';
import { getMajorCities } from '@/server/providers/cities';
import { getCountry, getWikipediaSummary } from '@/server/providers/countries';
import { getWeather } from '@/server/providers/open-meteo';

// `getCountry` fetches live World Bank indicators and the Wikipedia summary
// call hits an external API too, so this profile is rendered per request.
export const dynamic = 'force-dynamic';

export function generateMetadata({ params }: { params: { code: string } }): Metadata {
  const reference = countryByCode(params.code);
  if (!reference) return { title: 'Country not found' };
  return {
    title: reference.name,
    description: `Population, economy, geography and live indicators for ${reference.name}.`,
  };
}

export default async function CountryDetailPage({ params }: { params: { code: string } }) {
  const reference = countryByCode(params.code);
  if (!reference) notFound();

  const [detail, bio] = await Promise.all([
    getCountry(reference.code),
    getWikipediaSummary(reference.name).catch(() => null),
  ]);

  const borders = reference.borders
    .map((code3) => countryByCode(code3))
    .filter((entry): entry is CountryReference => entry !== undefined);

  const [cities, weather] = await Promise.all([
    getMajorCities(),
    getWeather(reference.center).catch(() => null),
  ]);
  const cityLinks = cities.filter((city) => city.countryCode === reference.code);

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          <>
            <Badge variant="primary">{reference.continent}</Badge>
            {reference.unMember ? <Badge variant="neutral">UN member</Badge> : null}
            {reference.landlocked ? <Badge variant="neutral">Landlocked</Badge> : null}
          </>
        }
        title={reference.name}
        description={reference.officialName}
      />

      <Card className="mb-8 overflow-hidden p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-5">
          <div className="border-border/60 relative h-[70px] w-[110px] shrink-0 overflow-hidden rounded-lg border">
            <Image
              src={flagUrl(reference.code, 160)}
              alt={`Flag of ${reference.name}`}
              fill
              sizes="110px"
              className="object-cover"
              priority
            />
          </div>

          <dl className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
            <Fact label="Capital" value={reference.capital ?? 'None'} />
            <Fact label="Population" value={formatCompact(reference.population)} />
            <Fact label="Area" value={formatArea(reference.areaKm2)} />
            <Fact label="Subregion" value={reference.subregion ?? '—'} />
          </dl>
        </div>
      </Card>

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            <MapEmbed
              center={reference.center}
              zoom={4}
              label={reference.name}
              className="h-[280px]"
            />
          </CardContent>
        </Card>

        {cityLinks.length > 0 ? (
          <Card>
            <CardContent className="pt-5">
              <p className="stat-label mb-3">Major cities</p>
              <div className="flex flex-col gap-1">
                {cityLinks.map((city) => (
                  <Link
                    key={city.id}
                    href={`/cities/${city.id}`}
                    className="focus-visible:ring-ring hover:bg-surface-muted group flex items-center gap-2 rounded-lg px-2 py-1.5 outline-none transition-colors focus-visible:ring-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm">{city.name}</span>
                    <span className="numeric text-muted-foreground text-xs">
                      {formatCompact(city.population)}
                    </span>
                    <ArrowUpRight
                      className="text-muted-foreground group-hover:text-primary size-3.5 shrink-0 transition-colors"
                      aria-hidden
                    />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {detail ? (
        <Section
          title="Economic & social indicators"
          description="Latest available values from the World Bank Open Data API. HDI is an estimate reconstructed from life expectancy, literacy and income."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="GDP (nominal)"
              value={detail.gdpUsd ? formatCompact(detail.gdpUsd) : '—'}
              unit="USD"
            />
            <StatCard
              label="GDP per capita"
              value={detail.gdpPerCapitaUsd ? formatCompact(detail.gdpPerCapitaUsd) : '—'}
              unit="USD"
            />
            <StatCard
              label="Life expectancy"
              value={detail.lifeExpectancy ? formatNumber(detail.lifeExpectancy, 1) : '—'}
              unit="years"
            />
            <StatCard
              label="HDI (estimate)"
              value={detail.hdi ? formatNumber(detail.hdi, 3) : '—'}
            />
            <StatCard
              label="Urban population"
              value={formatPercent(detail.urbanPopulationPct ?? null)}
            />
            <StatCard
              label="Internet users"
              value={formatPercent(detail.internetUsersPct ?? null)}
            />
            <StatCard
              label="CO₂ per capita"
              value={detail.co2TonnesPerCapita ? formatNumber(detail.co2TonnesPerCapita, 1) : '—'}
              unit="t"
            />
            <StatCard
              label="Renewable energy"
              value={formatPercent(detail.renewableEnergyPct ?? null)}
            />
          </div>
        </Section>
      ) : null}

      {weather ? (
        <Section
          title="Capital weather"
          description={`Live conditions near ${reference.capital ?? 'the capital'}.`}
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Temperature"
              value={formatTemperature(weather.now.temperature)}
              icon={<Thermometer />}
              hint={`Feels like ${formatTemperature(weather.now.apparentTemperature)}`}
            />
            <StatCard
              label="Condition"
              value={conditionLabel(weather.now.condition)}
              icon={<WeatherConditionIcon condition={weather.now.condition} />}
              hint={weather.attribution}
            />
            <StatCard
              label="Wind"
              value={`${formatNumber(weather.now.windSpeed)} km/h`}
              icon={<Wind />}
              hint={`${beaufortFor(weather.now.windSpeed).label} · force ${
                beaufortFor(weather.now.windSpeed).force
              }`}
            />
            <StatCard
              label="Humidity"
              value={formatPercent(weather.now.humidity, 0)}
              icon={<Droplets />}
            />
          </div>
        </Section>
      ) : null}

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="pt-5">
            <p className="stat-label mb-3">Currencies</p>
            <div className="flex flex-wrap gap-2">
              {reference.currencies.length > 0 ? (
                reference.currencies.map((currency) => (
                  <Badge key={currency.code} variant="neutral">
                    {currency.symbol ? `${currency.symbol} ` : ''}
                    {currency.name} ({currency.code})
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground text-sm">None</span>
              )}
            </div>

            <p className="stat-label mb-3 mt-5">Languages</p>
            <div className="flex flex-wrap gap-2">
              {reference.languages.length > 0 ? (
                reference.languages.map((language) => (
                  <Badge key={language.code} variant="neutral">
                    {language.name}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground text-sm">None recorded</span>
              )}
            </div>

            <p className="stat-label mb-3 mt-5">Calling codes</p>
            <p className="numeric text-sm">
              {reference.callingCodes.length > 0 ? reference.callingCodes.join(', ') : '—'}
            </p>

            <p className="stat-label mb-3 mt-5">Internet TLD</p>
            <p className="numeric text-sm">
              {reference.tld.length > 0 ? reference.tld.join(', ') : '—'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="stat-label mb-3">Border countries</p>
            {borders.length > 0 ? (
              <div className="flex flex-col gap-2">
                {borders.map((border) => (
                  <Link
                    key={border.code}
                    href={`/countries/${border.code.toLowerCase()}`}
                    className="focus-visible:ring-ring hover:bg-surface-muted group flex items-center gap-2 rounded-lg px-2 py-1.5 outline-none transition-colors focus-visible:ring-2"
                  >
                    <span className="text-lg leading-none" aria-hidden>
                      {border.flagEmoji}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{border.name}</span>
                    <ArrowUpRight
                      className="text-muted-foreground group-hover:text-primary size-3.5 shrink-0 transition-colors"
                      aria-hidden
                    />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No land borders{reference.landlocked ? '' : ' — an island or coastal-only nation'}.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {bio ? (
        <Section title="About" description={bio.title}>
          <Card>
            <CardContent className="flex flex-wrap gap-4 pt-5">
              {bio.thumbnail ? (
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg">
                  <Image
                    src={bio.thumbnail}
                    alt={bio.title}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed">{bio.extract}</p>
                <a
                  href={bio.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-primary mt-3 inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
                >
                  Read on Wikipedia
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              </div>
            </CardContent>
          </Card>
        </Section>
      ) : null}

      {detail?.mapsUrl ? (
        <a
          href={detail.mapsUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs transition-colors"
        >
          <MapPin className="size-3.5" aria-hidden />
          View on OpenStreetMap
        </a>
      ) : null}
    </PageContainer>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="stat-label">{label}</dt>
      <dd className="numeric mt-0.5 text-sm">{value}</dd>
    </div>
  );
}

const CONDITION_ICON: Record<WeatherCondition, LucideIcon> = {
  clear: Sun,
  mostly_clear: Sun,
  partly_cloudy: Cloud,
  overcast: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  freezing_rain: CloudRain,
  snow: Snowflake,
  snow_grains: Snowflake,
  showers: CloudRain,
  snow_showers: Snowflake,
  thunderstorm: CloudLightning,
  thunderstorm_hail: CloudLightning,
};

function WeatherConditionIcon({ condition }: { condition: WeatherCondition }) {
  const Icon = CONDITION_ICON[condition] ?? Cloud;
  return <Icon aria-hidden />;
}

function conditionLabel(condition: string): string {
  return condition
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
