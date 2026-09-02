'use client';

import type { WeatherCondition, WeatherDaily } from '@edt/shared';
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Droplets,
  Gauge,
  Snowflake,
  Sun,
  Sunrise,
  Sunset,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import * as React from 'react';

import { Card } from '@/components/ui/card';

const CONDITION_ICONS: Record<WeatherCondition, LucideIcon> = {
  clear: Sun,
  mostly_clear: Sun,
  partly_cloudy: CloudSun,
  overcast: Cloud,
  fog: CloudFog,
  drizzle: CloudRain,
  rain: CloudRain,
  freezing_rain: CloudRain,
  snow: Snowflake,
  snow_grains: Snowflake,
  showers: CloudRain,
  snow_showers: Snowflake,
  thunderstorm: CloudLightning,
  thunderstorm_hail: CloudLightning,
};

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDaylight(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

/**
 * Interactive 7-day outlook: tap a day to expand its full detail panel
 * (sun times, daylight, precipitation, UV and wind extremes).
 */
export function DailyOutlook({ days }: { days: WeatherDaily[] }) {
  const [selected, setSelected] = React.useState(0);

  if (days.length === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="text-muted-foreground text-sm">No daily forecast available.</p>
      </Card>
    );
  }

  const day = days[Math.min(selected, days.length - 1)];

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {days.slice(0, 7).map((d, index) => {
          const Icon = CONDITION_ICONS[d.condition] ?? Cloud;
          const active = index === selected;
          return (
            <button key={d.date} type="button" onClick={() => setSelected(index)} className="text-left">
              <Card
                className={
                  active
                    ? 'border-primary/50 bg-primary/10 p-4'
                    : 'hover:border-primary/30 p-4 transition-colors'
                }
              >
                <p className="text-sm font-medium">
                  {new Date(d.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit' })}
                </p>
                <Icon className="text-primary mt-2 size-5" aria-hidden />
                <p className="numeric mt-2 text-sm font-semibold">
                  {Math.round(d.temperatureMax)}°C / {Math.round(d.temperatureMin)}°C
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {d.precipitationProbability > 0 ? `${d.precipitationProbability}% rain` : 'Clear'}
                </p>
              </Card>
            </button>
          );
        })}
      </div>

      {day && (
        <Card className="border-primary/20 mt-4 p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h3 className="font-semibold">
              {new Date(day.date).toLocaleDateString('en-GB', {
                weekday: 'long',
                day: '2-digit',
                month: 'short',
              })}
            </h3>
            <p className="text-muted-foreground text-xs">tap any day above to inspect it</p>
          </div>
          <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6 text-sm">
            <div>
              <dt className="stat-label flex items-center gap-1">
                <Sunrise className="text-primary size-3.5" /> Sunrise
              </dt>
              <dd className="numeric mt-1 text-base font-semibold">{formatClock(day.sunrise)}</dd>
            </div>
            <div>
              <dt className="stat-label flex items-center gap-1">
                <Sunset className="text-primary size-3.5" /> Sunset
              </dt>
              <dd className="numeric mt-1 text-base font-semibold">{formatClock(day.sunset)}</dd>
            </div>
            <div>
              <dt className="stat-label">Daylight</dt>
              <dd className="numeric mt-1 text-base font-semibold">{formatDaylight(day.daylight)}</dd>
            </div>
            <div>
              <dt className="stat-label flex items-center gap-1">
                <Droplets className="text-primary size-3.5" /> Precipitation
              </dt>
              <dd className="numeric mt-1 text-base font-semibold">
                {day.precipitationSum > 0 ? `${day.precipitationSum} mm` : 'None'}
              </dd>
            </div>
            <div>
              <dt className="stat-label flex items-center gap-1">
                <Sun className="text-primary size-3.5" /> UV max
              </dt>
              <dd className="numeric mt-1 text-base font-semibold">{day.uvIndexMax.toFixed(1)}</dd>
            </div>
            <div>
              <dt className="stat-label flex items-center gap-1">
                <Wind className="text-primary size-3.5" /> Wind max
              </dt>
              <dd className="numeric mt-1 text-base font-semibold">
                {Math.round(day.windSpeedMax)} km/h
                <span className="text-muted-foreground ml-1 text-xs">gust {Math.round(day.windGustMax)}</span>
              </dd>
            </div>
          </dl>
          <p className="text-muted-foreground mt-4 flex items-center gap-1 text-xs">
            <Gauge className="size-3.5" />
            Rain chance {day.precipitationProbability}% · high {Math.round(day.temperatureMax)}°C / low{' '}
            {Math.round(day.temperatureMin)}°C
          </p>
        </Card>
      )}
    </div>
  );
}
