'use client';

import { Moon, Sun } from 'lucide-react';
import * as React from 'react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface TimezoneEntry {
  tz: string;
  label: string;
}

<<<<<<< HEAD
const TIMEZONES: TimezoneEntry[] = [
  // Pacific
=======
export const TIMEZONES: TimezoneEntry[] = [
>>>>>>> 005c357b565eaf6ff99b0cc04ff8ed07cf1d64a0
  { tz: 'Pacific/Midway', label: 'Midway Atoll' },
  { tz: 'Etc/GMT+11', label: 'Samoa' },
  { tz: 'Pacific/Honolulu', label: 'Honolulu' },
  { tz: 'Pacific/Marquesas', label: 'Marquesas' },
  { tz: 'America/Anchorage', label: 'Anchorage' },
  { tz: 'America/Juneau', label: 'Juneau' },
  { tz: 'America/Metlakatla', label: 'Ketchikan' },

  // Pacific/Mountain/Central US
  { tz: 'America/Los_Angeles', label: 'Los Angeles' },
  { tz: 'America/Vancouver', label: 'Vancouver' },
  { tz: 'America/Phoenix', label: 'Phoenix' },
  { tz: 'America/Denver', label: 'Denver' },
  { tz: 'America/Edmonton', label: 'Edmonton' },
  { tz: 'America/Chicago', label: 'Chicago' },
  { tz: 'America/Mexico_City', label: 'Mexico City' },

  // Eastern/Atlantic
  { tz: 'America/New_York', label: 'New York' },
  { tz: 'America/Toronto', label: 'Toronto' },
  { tz: 'America/Bogota', label: 'Bogotá' },
  { tz: 'America/Lima', label: 'Lima' },
  { tz: 'America/Sao_Paulo', label: 'São Paulo' },
  { tz: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires' },
  { tz: 'Atlantic/Stanley', label: 'Stanley' },

  // Atlantic/Europe
  { tz: 'Atlantic/Azores', label: 'Azores' },
  { tz: 'Atlantic/Cape_Verde', label: 'Cape Verde' },
  { tz: 'Atlantic/Reykjavik', label: 'Reykjavík' },
  { tz: 'Atlantic/St_Helena', label: 'St. Helena' },
  { tz: 'Europe/Lisbon', label: 'Lisbon' },
  { tz: 'Europe/London', label: 'London' },
  { tz: 'Europe/Dublin', label: 'Dublin' },
  { tz: 'Africa/Casablanca', label: 'Casablanca' },

  // Central Europe/Africa
  { tz: 'Europe/Paris', label: 'Paris' },
  { tz: 'Europe/Berlin', label: 'Berlin' },
  { tz: 'Europe/Amsterdam', label: 'Amsterdam' },
  { tz: 'Europe/Brussels', label: 'Brussels' },
  { tz: 'Europe/Vienna', label: 'Vienna' },
  { tz: 'Europe/Madrid', label: 'Madrid' },
  { tz: 'Europe/Rome', label: 'Rome' },
  { tz: 'Europe/Prague', label: 'Prague' },
  { tz: 'Europe/Warsaw', label: 'Warsaw' },
  { tz: 'Europe/Budapest', label: 'Budapest' },
  { tz: 'Africa/Lagos', label: 'Lagos' },
  { tz: 'Africa/Cairo', label: 'Cairo' },
  { tz: 'Africa/Johannesburg', label: 'Johannesburg' },

  // Eastern Europe/Asia
  { tz: 'Europe/Athens', label: 'Athens' },
  { tz: 'Europe/Istanbul', label: 'Istanbul' },
  { tz: 'Europe/Moscow', label: 'Moscow' },
  { tz: 'Asia/Dubai', label: 'Dubai' },
  { tz: 'Asia/Kolkata', label: 'Mumbai' },
  { tz: 'Asia/Kolkata', label: 'Delhi' },
  { tz: 'Asia/Bangkok', label: 'Bangkok' },
  { tz: 'Asia/Jakarta', label: 'Jakarta' },

  // East Asia
  { tz: 'Asia/Shanghai', label: 'Shanghai' },
  { tz: 'Asia/Hong_Kong', label: 'Hong Kong' },
  { tz: 'Asia/Singapore', label: 'Singapore' },
  { tz: 'Asia/Manila', label: 'Manila' },
  { tz: 'Asia/Tokyo', label: 'Tokyo' },
  { tz: 'Asia/Seoul', label: 'Seoul' },

  // Oceania
  { tz: 'Australia/Perth', label: 'Perth' },
  { tz: 'Australia/Adelaide', label: 'Adelaide' },
  { tz: 'Australia/Brisbane', label: 'Brisbane' },
  { tz: 'Australia/Sydney', label: 'Sydney' },
  { tz: 'Australia/Melbourne', label: 'Melbourne' },
  { tz: 'Pacific/Fiji', label: 'Fiji' },
  { tz: 'Pacific/Auckland', label: 'Auckland' },
];

interface TimeDetails {
  time: string;
  date: string;
  offsetLabel: string;
  offsetMinutes: number;
  isDaytime: boolean;
}

/**
 * Every tile shares one ticking clock rather than each running its own
 * `setInterval`, so 50+ cards cost one timer instead of 50+.
 */
export function WorldClockGrid() {
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const entries = React.useMemo(() => {
    if (!now) return TIMEZONES.map((entry) => ({ entry, details: null as TimeDetails | null }));
    return TIMEZONES.map((entry) => ({ entry, details: describeTime(now, entry.tz) })).sort(
      (a, b) => (a.details?.offsetMinutes ?? 0) - (b.details?.offsetMinutes ?? 0),
    );
  }, [now]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {entries.map(({ entry, details }) => (
        <ClockTile key={entry.tz} entry={entry} details={details} />
      ))}
    </div>
  );
}

function ClockTile({ entry, details }: { entry: TimezoneEntry; details: TimeDetails | null }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{entry.label}</p>
          <p className="text-muted-foreground truncate text-xs">{entry.tz}</p>
        </div>
        <span
          className={cn(
            'mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full',
            (details?.isDaytime ?? true)
              ? 'bg-warning/12 text-warning'
              : 'bg-secondary/12 text-secondary',
          )}
          aria-hidden
        >
          {(details?.isDaytime ?? true) ? (
            <Sun className="size-3.5" />
          ) : (
            <Moon className="size-3.5" />
          )}
        </span>
      </div>

      <p className="numeric mt-4 text-2xl font-semibold tabular-nums tracking-tight">
        {details?.time ?? '--:--:--'}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">
        {details ? `${details.date} · UTC${details.offsetLabel}` : '—'}
      </p>
    </Card>
  );
}

function describeTime(now: Date, timeZone: string): TimeDetails {
  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const dateFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
  const hourFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hour12: false,
  });
  const offsetFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  });

  const hour = Number(hourFormatter.format(now));
  const offsetPart = offsetFormatter
    .formatToParts(now)
    .find((part) => part.type === 'timeZoneName')?.value;
  const offsetLabel = (offsetPart ?? 'UTC').replace('GMT', '').replace('UTC', '') || '+0';
  const offsetMinutes = parseOffsetMinutes(offsetLabel);

  return {
    time: timeFormatter.format(now),
    date: dateFormatter.format(now),
    offsetLabel,
    offsetMinutes,
    isDaytime: hour >= 6 && hour < 18,
  };
}

/** Parses a "+05:30" / "-8" style offset label into signed minutes for sorting. */
function parseOffsetMinutes(label: string): number {
  const match = /^([+-])(\d{1,2})(?::(\d{2}))?$/.exec(label.trim());
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  return sign * (hours * 60 + minutes);
}
