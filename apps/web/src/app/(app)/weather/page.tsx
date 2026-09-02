import {
  beaufortFor,
  formatNumber,
  formatPercent,
  formatTemperature,
  type WeatherCondition,
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
  Navigation2,
  Snowflake,
  Sun,
  Sunrise,
  Sunset,
  Thermometer,
  Wind,
  Eye,
  Activity,
  MoonStar,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { StatCard, StatCardSkeleton } from '@/components/data/stat-card';
import { PageContainer, PageHeader, Section } from '@/components/layout/page-header';
import { LiveBadge, Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getWeather } from '@/server/providers/open-meteo';
import { getCityDetail } from '@/server/providers/cities';
import { CitySelector } from '@/components/weather/city-selector';
import { DailyOutlook } from '@/components/weather/daily-outlook';
import { DayNightChip } from '@/components/weather/day-night-chip';
import { FreshnessTicker } from '@/components/weather/freshness-ticker';
import { HourlyTrendChart } from '@/components/weather/hourly-trend-chart';
import { AutoRefresh } from '@/components/dashboard/auto-refresh';

export const metadata: Metadata = {
  title: 'Weather',
  description: 'Live current conditions, 24-hour outlook, 7-day forecast for cities worldwide.',
};

// Reads a live upstream feed, so the page is rendered per request
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

function conditionIcon(condition: WeatherCondition): LucideIcon {
  return CONDITION_ICON[condition] ?? Cloud;
}

function conditionLabel(condition: string): string {
  return condition
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Magnus approximation used when the upstream feed omits dew point. */
function dewPoint(tempC: number, relativeHumidity: number): number {
  const a = 17.62;
  const b = 243.12;
  const gamma = (a * tempC) / (b + tempC) + Math.log(Math.max(relativeHumidity, 1) / 100);
  return (b * gamma) / (a - gamma);
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDaylight(seconds: number): string {
  return `${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
}

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const SYNODIC_MONTH = 29.53058867;

/** Comfortable, dry, calm daylight hour — highlighted as a good outdoor slot. */
function isBestHour(hour: WeatherHourly): boolean {
  return (
    hour.isDay &&
    (hour.precipitationProbability ?? 100) <= 20 &&
    hour.temperature >= 18 &&
    hour.temperature <= 32 &&
    hour.windSpeed <= 20
  );
}

/** Lunar age/illumination from the synodic cycle — no external API needed. */
function moonPhase(date: Date): { name: string; illumination: number; age: number } {
  const days = (date.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 86_400_000;
  const age = ((days % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
  const illumination = Math.round(((1 - Math.cos((2 * Math.PI * age) / SYNODIC_MONTH)) / 2) * 100);
  const names = [
    'New Moon',
    'Waxing Crescent',
    'First Quarter',
    'Waxing Gibbous',
    'Full Moon',
    'Waning Gibbous',
    'Last Quarter',
    'Waning Crescent',
  ];
  return {
    name: names[Math.floor(((age / SYNODIC_MONTH) * 8 + 0.5) % 8)] ?? 'New Moon',
    illumination,
    age,
  };
}

function getWeatherAlert(temp: number, humidity: number, uvIndex: number, windSpeed: number): { level: string; message: string; color: string } | null {
  if (uvIndex >= 8) {
    return { level: 'High UV', message: 'Use sunscreen SPF 50+', color: 'text-red-400' };
  }
  if (windSpeed >= 50) {
    return { level: 'High Wind', message: 'Stay indoors if possible', color: 'text-orange-400' };
  }
  if (humidity >= 90 && temp >= 25) {
    return { level: 'High Heat & Humidity', message: 'Stay hydrated', color: 'text-yellow-400' };
  }
  if (temp <= -10) {
    return { level: 'Extreme Cold', message: 'Bundle up, limit outdoor time', color: 'text-blue-400' };
  }
  return null;
}

export default async function WeatherPage({
  searchParams,
}: {
  searchParams: { city?: string; lat?: string; lng?: string; name?: string; cc?: string; tz?: string };
}) {
  const cityId = searchParams.city || 'london-gb'; // Default to London
  const geo =
    searchParams.lat && searchParams.lng
      ? {
          lat: Number(searchParams.lat),
          lng: Number(searchParams.lng),
          name: searchParams.name || 'Selected location',
          cc: searchParams.cc || '—',
          tz: searchParams.tz,
        }
      : null;

  return (
    <>
      {/* Re-renders the server components every 60 s so day/night, stats and
          charts never go stale in an open tab. */}
      <AutoRefresh />
      <PageContainer>
      <PageHeader
        eyebrow={<LiveBadge />}
        title="Weather"
        description="Global weather conditions, 24-hour outlook, 7-day forecast, and atmospheric analysis."
      />

      <CitySelector currentCity={cityId} />

      <Suspense fallback={<WeatherSkeleton />}>
        <WeatherView cityId={cityId} geo={geo} />
      </Suspense>
      </PageContainer>
    </>
  );
}

async function WeatherView({
  cityId,
  geo,
}: {
  cityId: string;
  geo: { lat: number; lng: number; name: string; cc: string; tz?: string } | null;
}) {
  // Get city details
  const city = await getCityDetail(cityId);

  // Vendored gazetteer first, then the geocoded pick, then London.
  const location = city
    ? { lng: city.center.lng, lat: city.center.lat }
    : geo
      ? { lng: geo.lng, lat: geo.lat }
      : { lng: -0.1278, lat: 51.5074 };
  // 'auto' lets Open-Meteo resolve the timezone from the coordinates — a hardcoded
  // fallback would silently mis-time geo-picked locations like reverse-geocoded ones.
  const timezone = city?.timezone || geo?.tz || 'auto';
  const cityName = city?.name || geo?.name || 'London';
  const countryCode = city?.countryCode || geo?.cc || 'GB';

  const weather = await getWeather(location, timezone);
  const beaufort = beaufortFor(weather.now.windSpeed);
  const ConditionIcon = conditionIcon(weather.now.condition);
  const alert = getWeatherAlert(weather.now.temperature, weather.now.humidity, weather.now.uvIndex, weather.now.windSpeed);

  const nowTime = new Date(weather.now.observedAt).getTime();
  // hourly times are city wall-clock strings, so compare against "now" in the
  // city's own wall clock (includes the current hour so the strip never empties).
  const cityNowMs = new Date(
    new Date(nowTime).toLocaleString('en-US', { timeZone: weather.timezone }),
  ).getTime();
  const nextHours = weather.hourly
    .filter((hour) => new Date(hour.time).getTime() >= cityNowMs - 3_600_000)
    .slice(0, 24);
  // The feed includes two past days — daily[0] is NOT today. Match the city's date.
  const todayDate = new Intl.DateTimeFormat('en-CA', { timeZone: weather.timezone }).format(
    new Date(nowTime),
  );
  const today = weather.daily.find((day) => day.date === todayDate) ?? weather.daily[0];
  const outlookDays = weather.daily.filter((day) => day.date >= todayDate).slice(0, 7);
  const cardinal = CARDINALS[Math.round(weather.now.windDirection / 45) % 8];
  const moon = moonPhase(new Date());

  // Longest contiguous run of comfortable hours in the next 24h.
  const bestWindow = (() => {
    let runStart: string | null = null;
    let run = 0;
    let bestRun = 0;
    let bestStart = '';
    let bestEnd = '';
    for (const hour of nextHours) {
      if (isBestHour(hour)) {
        if (run === 0) runStart = hour.time;
        run += 1;
        if (run > bestRun) {
          bestRun = run;
          bestStart = runStart ?? hour.time;
          bestEnd = hour.time;
        }
      } else {
        run = 0;
      }
    }
    return bestRun >= 2 ? { start: bestStart, end: bestEnd } : null;
  })();

  // Calculate averages for the day
  const avgTemp = nextHours.length > 0
    ? nextHours.reduce((sum, h) => sum + h.temperature, 0) / nextHours.length
    : weather.now.temperature;
  const maxTemp = Math.max(...nextHours.map(h => h.temperature), weather.now.temperature);
  const minTemp = Math.min(...nextHours.map(h => h.temperature), weather.now.temperature);

  return (
    <>
      {/* Location Badge */}
      <Card className="mb-6 p-4 bg-primary/5 border-primary/20">
        <div className="flex items-center gap-3">
          <Badge variant="primary" className="text-sm">
            📍 {cityName}, {countryCode}
          </Badge>
          <p className="text-sm text-muted-foreground">
            Live weather data · Updated every 10 minutes
          </p>
          <FreshnessTicker fetchedAt={weather.fetchedAt} />
          <DayNightChip
            sunrise={today?.sunrise ?? ''}
            sunset={today?.sunset ?? ''}
            timezone={weather.timezone}
            fallbackIsDay={weather.now.isDay}
          />
        </div>
      </Card>

      {/* Weather Alert */}
      {alert && (
        <Card className="mb-8 border-orange-500/30 bg-orange-500/5 p-4">
          <div className="flex items-center gap-3">
            <Zap className={`size-5 ${alert.color}`} />
            <div>
              <p className={`font-semibold ${alert.color}`}>{alert.level}</p>
              <p className="text-muted-foreground text-sm">{alert.message}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Current Conditions */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
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
          hint={weather.now.humidity >= 70 ? 'High' : 'Normal'}
        />
        <StatCard
          label="Pressure"
          value={`${formatNumber(weather.now.pressure)} hPa`}
          icon={<Gauge />}
          hint={weather.now.pressure >= 1013 ? 'Rising' : 'Falling'}
        />
        <StatCard
          label="UV Index"
          value={formatNumber(weather.now.uvIndex, 1)}
          icon={<Sun />}
          hint={weather.now.uvIndex >= 6 ? 'High' : 'Normal'}
          intent={weather.now.uvIndex >= 6 ? 'warning' : 'neutral'}
        />
      </div>

      {/* Advanced Metrics */}
      <Card className="mb-8 p-5">
        <h3 className="font-semibold mb-4">Advanced Metrics</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Visibility</dt>
            <dd className="numeric mt-2 text-lg font-semibold flex items-center gap-2">
              <Eye className="size-4 text-primary" />
              {weather.now.visibility ? `${(weather.now.visibility / 1000).toFixed(1)} km` : 'N/A'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Dew Point</dt>
            <dd className="numeric mt-2 text-lg font-semibold">
              {formatTemperature(weather.now.dewPoint ?? dewPoint(weather.now.temperature, weather.now.humidity))}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Today&apos;s High/Low</dt>
            <dd className="numeric mt-2 text-lg font-semibold">
              {formatTemperature(maxTemp)} / {formatTemperature(minTemp)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Precipitation</dt>
            <dd className="numeric mt-2 text-lg font-semibold flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              {weather.now.precipitation ? `${weather.now.precipitation} mm` : 'None'}
            </dd>
          </div>
        </div>
      </Card>

      {/* Sun, wind & atmosphere */}
      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Sun &amp; Daylight</h3>
          {today ? (
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="stat-label flex items-center gap-1">
                  <Sunrise className="text-primary size-3.5" /> Sunrise
                </dt>
                <dd className="numeric mt-1 text-base font-semibold">{formatClock(today.sunrise)}</dd>
              </div>
              <div>
                <dt className="stat-label flex items-center gap-1">
                  <Sunset className="text-primary size-3.5" /> Sunset
                </dt>
                <dd className="numeric mt-1 text-base font-semibold">{formatClock(today.sunset)}</dd>
              </div>
              <div>
                <dt className="stat-label">Daylight</dt>
                <dd className="numeric mt-1 text-base font-semibold">{formatDaylight(today.daylight)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-muted-foreground text-sm">No sun data available.</p>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-4">Wind Direction</h3>
          <div className="flex items-center gap-4">
            <div className="border-border relative flex size-20 shrink-0 items-center justify-center rounded-full border">
              <Navigation2
                className="text-primary size-6 transition-transform"
                style={{ transform: `rotate(${(weather.now.windDirection + 180) % 360}deg)` }}
              />
            </div>
            <div>
              <p className="numeric text-2xl font-bold">{cardinal}</p>
              <p className="text-muted-foreground text-xs">blowing from {weather.now.windDirection}°</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-4">At a Glance</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Cloud cover</dt>
              <dd className="numeric">{formatPercent(weather.now.cloudCover, 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Wind gusts</dt>
              <dd className="numeric">{formatNumber(weather.now.windGust)} km/h</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Feels-like delta</dt>
              <dd className="numeric">
                {formatTemperature(weather.now.apparentTemperature - weather.now.temperature)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Best outdoor window</dt>
              <dd className="numeric text-success">
                {bestWindow ? `${formatClock(bestWindow.start)}–${formatClock(bestWindow.end)}` : '—'}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-4">Moon Phase</h3>
          <div className="flex items-center gap-4">
            <div className="border-border relative flex size-20 shrink-0 items-center justify-center rounded-full border">
              <MoonStar className="text-primary size-6" />
            </div>
            <div>
              <p className="text-base font-bold">{moon.name}</p>
              <p className="text-muted-foreground text-xs">
                {moon.illumination}% illuminated · day {Math.round(moon.age)} of 29.5
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* 24-hour trend chart */}
      <Section
        title="24-hour trend"
        description="Temperature curve with rain-probability bars; shaded bands mark night hours."
      >
        <Card className="p-5">
          <HourlyTrendChart hours={nextHours} />
        </Card>
      </Section>

      {/* 24 Hour Forecast */}
      <Section
        title="Next 24 hours"
        description="Hour-by-hour with day/night markers — green ring flags the best outdoor hours."
      >
        {nextHours.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-muted-foreground text-sm">No hourly forecast available.</p>
          </Card>
        ) : (
          <div className="scrollbar-none -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
            {nextHours.map((hour) => (
              <HourTile key={hour.time} hour={hour} best={isBestHour(hour)} />
            ))}
          </div>
        )}
      </Section>

      {/* 7 Day Forecast */}
      <Section
        title="7-day outlook"
        description="Daily high/low temperatures and precipitation probability — tap a day for full details."
      >
        <DailyOutlook days={outlookDays} />
      </Section>

      {/* Data Attribution */}
      <Card className="mt-8 p-4">
        <p className="text-muted-foreground text-xs">
          Weather data provided by <strong>Open-Meteo</strong>. Updated every 10 minutes.
          Location: {cityName}, {countryCode}. All forecasts are based on numerical weather prediction models.
        </p>
      </Card>
    </>
  );
}

function HourTile({ hour, best }: { hour: WeatherHourly; best: boolean }) {
  const Icon = conditionIcon(hour.condition);
  const precipChance = hour.precipitationProbability ?? 0;

  return (
    <Card
      className={
        best
          ? 'border-success/50 ring-success/30 w-24 shrink-0 p-3 text-center ring-1'
          : 'w-24 shrink-0 p-3 text-center'
      }
    >
      <p className="text-muted-foreground flex items-center justify-center gap-1 text-xs">
        {hour.isDay ? (
          <Sun className="text-amber-300 size-3" aria-hidden />
        ) : (
          <MoonStar className="text-indigo-300 size-3" aria-hidden />
        )}
        {new Date(hour.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
      </p>
      <Icon className="text-primary mx-auto mt-2 size-5" aria-hidden />
      <p className="stat-value mt-2 text-lg">{formatTemperature(hour.temperature)}</p>
      <p className="text-2xs text-muted-foreground mt-1">
        {precipChance > 0 ? `${precipChance}%` : '—'}
      </p>
      {best && <p className="text-2xs text-success mt-1 font-semibold">★ Best</p>}
    </Card>
  );
}

function WeatherSkeleton() {
  return (
    <>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
      <Card className="mb-8 p-5">
        <Skeleton className="h-5 w-32 mb-4" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-16" />
          ))}
        </div>
      </Card>
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
