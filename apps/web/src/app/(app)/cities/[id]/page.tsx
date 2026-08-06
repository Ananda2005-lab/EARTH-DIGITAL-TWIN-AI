import {
  beaufortFor,
  countryCodeToFlagEmoji,
  formatCompact,
  formatCoordinates,
  formatNumber,
  formatPercent,
  formatTemperature,
  type WeatherCondition,
} from '@edt/shared';
import {
  ArrowLeft,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  Droplets,
  MapPin,
  Plane,
  Snowflake,
  Sun,
  Thermometer,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { StatCard } from '@/components/data/stat-card';
import { PageContainer, PageHeader, Section } from '@/components/layout/page-header';
import { MapEmbed } from '@/components/map/map-embed';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { countryByCode } from '@/lib/data/countries';
import { getCityByIdentifier } from '@/server/providers/cities';
import { findNearestAirports } from '@/server/providers/flights';
import { getWeather } from '@/server/providers/open-meteo';

// Live weather from Open-Meteo is fetched per request.
export const dynamic = 'force-dynamic';

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

function conditionLabel(condition: string): string {
  return condition
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const city = await getCityByIdentifier(params.id);
  if (!city) return { title: 'City not found' };
  return {
    title: city.name,
    description: `Population, location and live weather for ${city.name}.`,
  };
}

export default async function CityDetailPage({ params }: { params: { id: string } }) {
  const city = await getCityByIdentifier(params.id);
  if (!city) notFound();

  const country = countryByCode(city.countryCode);
  const [weather, airports] = await Promise.all([
    getWeather(city.center).catch(() => null),
    Promise.resolve(findNearestAirports(city.center, 3)),
  ]);

  const condition = weather?.now.condition;
  const ConditionIcon = condition ? (CONDITION_ICON[condition] ?? Cloud) : Cloud;

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          <>
            <span className="text-lg leading-none" aria-hidden>
              {countryCodeToFlagEmoji(city.countryCode)}
            </span>
            {country ? (
              <Badge variant="primary">{country.name}</Badge>
            ) : (
              <Badge variant="primary">{city.countryCode}</Badge>
            )}
          </>
        }
        title={city.name}
        description={`${formatCompact(city.population)} people · ${formatCoordinates(
          city.center.lng,
          city.center.lat,
          2,
        )}`}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/cities">
                <ArrowLeft aria-hidden />
                All cities
              </Link>
            </Button>
            <Button asChild variant="glass" size="sm">
              <Link href="/map">
                <MapPin aria-hidden />
                Open in 2D map
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            <MapEmbed
              center={city.center}
              zoom={9}
              label={`${city.name} · ${country?.name ?? city.countryCode}`}
              className="h-[280px]"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="stat-label mb-3">Overview</p>
            <dl className="flex flex-col gap-3">
              <Fact label="Country" value={country?.name ?? city.countryCode} />
              <Fact label="Population" value={`${formatCompact(city.population)} people`} />
              <Fact label="Latitude" value={formatNumber(city.center.lat, 4)} />
              <Fact label="Longitude" value={formatNumber(city.center.lng, 4)} />
            </dl>
            {country ? (
              <Link
                href={`/countries/${country.code.toLowerCase()}`}
                className="text-primary mt-4 inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
              >
                Visit {country.name}
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {weather ? (
        <Section title="Current weather" description={`Live conditions for ${city.name}.`}>
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
              icon={<ConditionIcon />}
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

      <Section
        title="Nearest airports"
        description="Closest major airports by great-circle proximity."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {airports.map((airport) => (
            <Card key={airport.icao} className="p-4">
              <div className="flex items-center gap-2">
                <Plane className="text-primary size-4 shrink-0" aria-hidden />
                <p className="min-w-0 flex-1 truncate text-sm font-medium">
                  {airport.city ?? airport.icao}
                </p>
                <Badge variant="neutral">{airport.iata ?? airport.icao}</Badge>
              </div>
              <p className="text-muted-foreground mt-2 truncate text-xs">{airport.name}</p>
            </Card>
          ))}
        </div>
      </Section>
    </PageContainer>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="stat-label">{label}</dt>
      <dd className="numeric text-right text-sm">{value}</dd>
    </div>
  );
}
