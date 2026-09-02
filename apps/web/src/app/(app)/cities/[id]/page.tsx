import { countryCodeToFlagEmoji, formatCompact, formatTemperature, formatPercent, formatNumber } from '@edt/shared';
import { MapPin, Navigation, Thermometer, Wind, Droplets, Gauge, Sun, Cloud } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { PageContainer, PageHeader, Section } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/data/stat-card';
import { countryByCode } from '@/lib/data/countries';
import { getCityDetail } from '@/server/providers/cities';
import { getWeather } from '@/server/providers/open-meteo';
import { beaufortFor } from '@edt/shared';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const city = await getCityDetail(params.id);
  if (!city) return { title: 'City not found' };
  return {
    title: city.name,
    description: `Population, location and live conditions for ${city.name}.`,
  };
}

export default async function CityDetailPage({ params }: { params: { id: string } }) {
  const city = await getCityDetail(params.id);

  if (!city) notFound();

  const country = countryByCode(city.countryCode);
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${city.center.lat},${city.center.lng}`;
  const osmUrl = `https://www.openstreetmap.org/?mlat=${city.center.lat}&mlon=${city.center.lng}#map=12/${city.center.lat}/${city.center.lng}`;

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          <>
            <Badge variant="primary">
              {countryCodeToFlagEmoji(city.countryCode)} {country?.name ?? city.countryCode}
            </Badge>
            {city.isCapital ? <Badge variant="warning">Capital</Badge> : null}
            <Badge variant="neutral">Urban center</Badge>
          </>
        }
        title={city.name}
        description={`${city.admin1 ? `${city.admin1}, ` : ''}${country?.name ?? city.countryCode} • ${formatCompact(city.population)} people${city.metroPopulation ? ` (${formatCompact(city.metroPopulation)} metro)` : ''}`}
      />

      <Card className="mb-8 overflow-hidden p-5 sm:p-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Population" value={formatCompact(city.population)} />
          {city.metroPopulation ? (
            <Fact label="Metro area" value={formatCompact(city.metroPopulation)} />
          ) : null}
          {city.areaKm2 ? (
            <Fact
              label="Area"
              value={`${city.areaKm2.toLocaleString('en-US', { maximumFractionDigits: 0 })} km²`}
            />
          ) : null}
          <Fact
            label="Coordinates"
            value={`${city.center.lat.toFixed(4)}°, ${city.center.lng.toFixed(4)}°`}
          />
          {city.elevationM !== undefined && city.elevationM !== null ? (
            <Fact label="Elevation" value={`${city.elevationM.toLocaleString()} m`} />
          ) : null}
          <Fact label="Timezone" value={city.timezone} />
          <Fact label="Country" value={country?.name ?? city.countryCode} />
          <Fact label="Capital status" value={city.isCapital ? 'Yes' : 'No'} />
        </div>
      </Card>

      {/* Live Weather Section */}
      <Suspense fallback={<WeatherSkeleton />}>
        <WeatherSection city={city} />
      </Suspense>

      <Section
        title="Location"
        description="Geographic coordinates and timezone for this urban area. Population figures include metro area when available."
      >
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Latitude</span>
              <span className="numeric text-sm">{city.center.lat.toFixed(6)}°</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Longitude</span>
              <span className="numeric text-sm">{city.center.lng.toFixed(6)}°</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">IANA Timezone</span>
              <span className="numeric text-sm">{city.timezone}</span>
            </div>

            <div className="border-border/60 border-t pt-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={googleMapsUrl} target="_blank" rel="noreferrer noopener">
                    <MapPin />
                    Google Maps
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={osmUrl} target="_blank" rel="noreferrer noopener">
                    <Navigation />
                    OpenStreetMap
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </Section>

      {city.admin1 ? (
        <Section title="Administrative division" description="Region or state within the country.">
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm">{city.admin1}</p>
            </CardContent>
          </Card>
        </Section>
      ) : null}

      <Section
        title="Live data integration"
        description="Real-time weather, hazards, air quality and local news will be integrated into city profiles soon."
      >
        <Card>
          <CardContent className="pt-5">
            <p className="text-muted-foreground text-sm leading-relaxed">
              This city profile is fetched from the comprehensive urban gazetteer API with{' '}
              {city.population.toLocaleString()} residents
              {city.metroPopulation
                ? ` and a metropolitan area of ${city.metroPopulation.toLocaleString()}`
                : ''}
              . Additional live feeds (weather, hazards, AQI, news) will be added as the platform
              expands.
            </p>
          </CardContent>
        </Card>
      </Section>
    </PageContainer>
  );
}

async function WeatherSection({ city }: { city: Awaited<ReturnType<typeof getCityDetail>> }) {
  if (!city) return null;
  const weather = await getWeather(city.center, city.timezone);
  const beaufort = beaufortFor(weather.now.windSpeed);

  const nextHours = weather.hourly
    .filter((hour) => new Date(hour.time).getTime() >= new Date(weather.now.observedAt).getTime())
    .slice(0, 12);

  return (
    <Section title="Live Weather" description={`Current conditions in ${city.name}, ${city.countryCode}`}>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Temperature"
          value={formatTemperature(weather.now.temperature)}
          icon={<Thermometer />}
          hint={`Feels like ${formatTemperature(weather.now.apparentTemperature)}`}
        />
        <StatCard
          label="Condition"
          value={weather.now.condition
            .split('_')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')}
          icon={<Cloud />}
          hint="Current"
        />
        <StatCard
          label="Wind"
          value={`${formatNumber(weather.now.windSpeed)} km/h`}
          icon={<Wind />}
          hint={`${beaufort.label} · Force ${beaufort.force}`}
        />
        <StatCard
          label="Humidity"
          value={formatPercent(weather.now.humidity, 0)}
          icon={<Droplets />}
        />
      </div>

      {nextHours.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <h4 className="font-semibold mb-4">Next 12 hours</h4>
            <div className="scrollbar-none -mx-5 flex gap-3 overflow-x-auto px-5 pb-2">
              {nextHours.map((hour) => (
                <div key={hour.time} className="w-20 shrink-0 text-center text-xs">
                  <p className="text-muted-foreground">
                    {new Date(hour.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="mt-2 font-semibold text-sm">{formatTemperature(hour.temperature)}</p>
                  <p className="text-2xs text-muted-foreground mt-1">{hour.precipitationProbability}%</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </Section>
  );
}

function WeatherSkeleton() {
  return (
    <div className="mb-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="stat-label">{label}</dt>
      <dd className="numeric mt-1 text-sm">{value}</dd>
    </div>
  );
}
