'use client';

import { Moon, Sun } from 'lucide-react';
import * as React from 'react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface TimezoneEntry {
  tz: string;
  label: string;
}

export const TIMEZONES: TimezoneEntry[] = [
  { tz: 'Pacific/Midway', label: 'Midway Atoll' },
  { tz: 'Pacific/Honolulu', label: 'Honolulu' },
  { tz: 'America/Anchorage', label: 'Anchorage' },
  { tz: 'America/Los_Angeles', label: 'Los Angeles' },
  { tz: 'America/Denver', label: 'Denver' },
  { tz: 'America/Chicago', label: 'Chicago' },
  { tz: 'America/New_York', label: 'New York' },
  { tz: 'America/Sao_Paulo', label: 'São Paulo' },
  { tz: 'Atlantic/Reykjavik', label: 'Reykjavík' },
  { tz: 'Europe/London', label: 'London' },
  { tz: 'Europe/Paris', label: 'Paris' },
  { tz: 'Europe/Berlin', label: 'Berlin' },
  { tz: 'Europe/Athens', label: 'Athens' },
  { tz: 'Europe/Moscow', label: 'Moscow' },
  { tz: 'Africa/Cairo', label: 'Cairo' },
  { tz: 'Africa/Lagos', label: 'Lagos' },
  { tz: 'Africa/Johannesburg', label: 'Johannesburg' },
  { tz: 'Asia/Dubai', label: 'Dubai' },
  { tz: 'Asia/Kolkata', label: 'Mumbai' },
  { tz: 'Asia/Bangkok', label: 'Bangkok' },
  { tz: 'Asia/Shanghai', label: 'Shanghai' },
  { tz: 'Asia/Tokyo', label: 'Tokyo' },
  { tz: 'Asia/Seoul', label: 'Seoul' },
  { tz: 'Australia/Perth', label: 'Perth' },
  { tz: 'Australia/Sydney', label: 'Sydney' },
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
 * `setInterval`, so 26 cards cost one timer instead of 26.
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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
