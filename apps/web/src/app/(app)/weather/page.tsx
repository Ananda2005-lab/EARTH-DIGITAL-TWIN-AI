import {
  beaufortFor,
  formatNumber,
  formatPercent,
  formatTemperature,
  type WeatherCondition,
  type WeatherDaily,
  type WeatherHourly,
} from '@edt/shared';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  Droplets,
  Gauge,
  Snowflake,
  Sun,
  Thermometer,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { StatCard, StatCardSkeleton } from '@/components/data/stat-card';
import { PageContainer, PageHeader, Section } from '@/components/layout/page-header';
import { LiveBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getWeather } from '@/server/providers/open-meteo';

export const metadata: Metadata = {
  title: 'Weather',
  description: 'Live current conditions, a 24-hour outlook and a 7-day forecast from Open-Meteo.',
};

// Reads a live upstream feed, so the page is rendered per request rather than
// prerendered at build time.
export const dynamic = 'force-dynamic';

// London — hardcoded default until a location search/picker exists.
const DEFAULT_LOCATION = { lng: -0.1278, lat: 51.5074 };
const DEFAULT_TIMEZONE = 'Europe/London';

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

function conditionIcon(condition: WeatherCondition): LucideIcon {
  return CONDITION_ICON[condition] ?? Cloud;
}

function conditionLabel(condition: string): string {
  return condition
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function WeatherPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow={<LiveBadge />}
        title="Weather"
        description="Current conditions, a 24-hour outlook and a 7-day forecast, powered by Open-Meteo."
      />

      <Suspense fallback={<WeatherSkeleton />}>
        <WeatherView />
      </Suspense>
    </PageContainer>
  );
}

async function WeatherView() {
  const weather = await getWeather(DEFAULT_LOCATION, DEFAULT_TIMEZONE);
  const beaufort = beaufortFor(weather.now.windSpeed);
  const ConditionIcon = conditionIcon(weather.now.condition);

  const nowTime = new Date(weather.now.observedAt).getTime();
  const nextHours = weather.hourly
    .filter((hour) => new Date(hour.time).getTime() >= nowTime)
    .slice(0, 24);

  return (
    <>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          hint={`${beaufort.label} · force ${beaufort.force}`}
        />
        <StatCard
          label="Humidity"
          value={formatPercent(weather.now.humidity, 0)}
          icon={<Droplets />}
        />
        <StatCard
          label="Pressure"
          value={`${formatNumber(weather.now.pressure)} hPa`}
          icon={<Gauge />}
        />
        <StatCard
          label="UV index"
          value={formatNumber(weather.now.uvIndex, 1)}
          icon={<Sun />}
          intent={weather.now.uvIndex >= 6 ? 'warning' : 'neutral'}
        />
      </div>

      <Section
        title="Next 24 hours"
        description="Temperature and condition for each of the next 24 hours."
      >
        {nextHours.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-muted-foreground text-sm">No hourly forecast available.</p>
          </Card>
        ) : (
          <div className="scrollbar-none -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
            {nextHours.map((hour) => (
              <HourTile key={hour.time} hour={hour} />
            ))}
          </div>
        )}
      </Section>

      <Section title="7-day outlook" description="Daily high/low and precipitation chance.">
        {weather.daily.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-muted-foreground text-sm">No daily forecast available.</p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {weather.daily.slice(0, 7).map((day) => (
              <DayTile key={day.date} day={day} />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

function HourTile({ hour }: { hour: WeatherHourly }) {
  const Icon = conditionIcon(hour.condition);
  return (
    <Card className="w-24 shrink-0 p-3 text-center">
      <p className="text-muted-foreground text-xs">
        {new Date(hour.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
      </p>
      <Icon className="text-primary mx-auto mt-2 size-5" aria-hidden />
      <p className="stat-value mt-2 text-lg">{formatTemperature(hour.temperature)}</p>
      <p className="text-2xs text-muted-foreground mt-1">
        {formatPercent(hour.precipitationProbability, 0)}
      </p>
    </Card>
  );
}

function DayTile({ day }: { day: WeatherDaily }) {
  const Icon = conditionIcon(day.condition);
  return (
    <Card className="p-4">
      <p className="text-sm font-medium">
        {new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit' })}
      </p>
      <Icon className="text-primary mt-2 size-5" aria-hidden />
      <p className="numeric mt-2 text-sm">
        {formatTemperature(day.temperatureMax)} / {formatTemperature(day.temperatureMin)}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">
        {formatPercent(day.precipitationProbability, 0)} precip
      </p>
    </Card>
  );
}

function WeatherSkeleton() {
  return (
    <>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 6 }, (_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
      <Card className="p-5">
        <Skeleton className="h-5 w-32" />
        <div className="mt-4 flex gap-3 overflow-x-hidden">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-28 w-24 shrink-0" />
          ))}
        </div>
      </Card>
    </>
  );
}
