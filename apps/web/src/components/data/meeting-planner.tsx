'use client';

import { AlarmClock, CalendarClock, Sunrise, Users } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { TIMEZONES } from './world-clock-grid';

const WORK_START = 9;
const WORK_END = 18;
const DST_WINDOW_DAYS = 30;

interface ZoneInfo {
  hour: number;
  minute: number;
  label: string;
  date: string;
  offsetLabel: string;
  offsetMinutes: number;
  isWorking: boolean;
}

/** Reusable per-zone formatter — 26 zones share 3 formatters instead of 78. */
function makeZoneFormatters(timeZone: string) {
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
  const hour = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hour12: false });
  const offset = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  });
  return { time, date, hour, offset };
}

function describeZone(instant: Date, timeZone: string): ZoneInfo {
  const f = makeZoneFormatters(timeZone);
  const offsetPart = f.offset
    .formatToParts(instant)
    .find((part) => part.type === 'timeZoneName')?.value;
  const offsetLabel = (offsetPart ?? 'UTC').replace('GMT', '').replace('UTC', '') || '+0';
  return {
    hour: Number(f.hour.format(instant)),
    minute: Number(f.time.formatToParts(instant).find((p) => p.type === 'minute')?.value ?? 0),
    label: f.time.format(instant),
    date: f.date.format(instant),
    offsetLabel,
    offsetMinutes: parseOffsetMinutes(offsetLabel),
    isWorking: (() => {
      const h = Number(f.hour.format(instant));
      return h >= WORK_START && h < WORK_END;
    })(),
  };
}

/** Parses "+05:30" / "-8" style offset labels into signed minutes. */
function parseOffsetMinutes(label: string): number {
  const match = /^([+-])(\d{1,2})(?::(\d{2}))?$/.exec(label.trim());
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}

/** Interprets a wall-clock time in an IANA zone as an absolute instant. */
function zonedWallToUtc(date: string, time: string, timeZone: string): Date {
  const [y = 0, m = 1, d = 1] = date.split('-').map((part) => Number(part));
  const [hh = 0, mm = 0] = time.split(':').map((part) => Number(part));
  const utcGuess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const f = makeZoneFormatters(timeZone);
  const offsetPart = f.offset
    .formatToParts(utcGuess)
    .find((part) => part.type === 'timeZoneName')?.value;
  const offsetMinutes = parseOffsetMinutes((offsetPart ?? 'UTC').replace('GMT', '').replace('UTC', ''));
  const adjusted = new Date(utcGuess.getTime() - offsetMinutes * 60_000);
  const check = makeZoneFormatters(timeZone).offset
    .formatToParts(adjusted)
    .find((part) => part.type === 'timeZoneName')?.value;
  const checkOffset = parseOffsetMinutes((check ?? 'UTC').replace('GMT', '').replace('UTC', ''));
  if (checkOffset !== offsetMinutes) {
    return new Date(utcGuess.getTime() - checkOffset * 60_000);
  }
  return adjusted;
}

/** True when the zone's UTC offset changes within the DST window. */
function hasDstChangeSoon(timeZone: string, from: Date): boolean {
  const later = new Date(from.getTime() + DST_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const f = makeZoneFormatters(timeZone);
  const a = f.offset.formatToParts(from).find((p) => p.type === 'timeZoneName')?.value;
  const b = f.offset.formatToParts(later).find((p) => p.type === 'timeZoneName')?.value;
  return parseOffsetMinutes((a ?? '').replace('GMT', '').replace('UTC', '')) !==
    parseOffsetMinutes((b ?? '').replace('GMT', '').replace('UTC', ''));
}

const DEFAULT_BASE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const DEFAULT_SELECTED = ['America/New_York', 'Europe/London', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Tokyo'];

function toInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MeetingPlanner() {
  const [baseTz, setBaseTz] = React.useState(DEFAULT_BASE);
  const now = React.useMemo(() => new Date(), []);
  const [wall, setWall] = React.useState(toInputValue(now));
  const [selected, setSelected] = React.useState<Set<string>>(new Set(DEFAULT_SELECTED));

  const { date = '2024-01-01', time = '12:00' } = React.useMemo(() => {
    const [d, t] = wall.split('T');
    return { date: d, time: t };
  }, [wall]);

  const instant = React.useMemo(
    () => zonedWallToUtc(date, time, baseTz),
    [date, time, baseTz],
  );

  const rows = React.useMemo(
    () =>
      TIMEZONES.filter((entry) => selected.has(entry.tz)).map((entry) => ({
        entry,
        info: describeZone(instant, entry.tz),
        dstSoon: hasDstChangeSoon(entry.tz, instant),
      })),
    [selected, instant],
  );

  const workingCount = rows.filter((row) => row.info.isWorking).length;

  const bestHours = React.useMemo(() => {
    const base = new Date(Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()));
    const counts = Array.from({ length: 24 }, (_, utcHour) => {
      const probe = new Date(base.getTime() + utcHour * 60 * 60 * 1000);
      const working = TIMEZONES.filter((entry) => selected.has(entry.tz)).filter(
        (entry) => describeZone(probe, entry.tz).isWorking,
      ).length;
      return { utcHour, working };
    });
    return counts.sort((a, b) => b.working - a.working).slice(0, 3);
  }, [selected, instant]);

  const toggle = (tz: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tz)) next.delete(tz);
      else next.add(tz);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="grid gap-2">
            <Label htmlFor="meeting-base-tz" className="text-muted-foreground text-xs">
              Your timezone
            </Label>
            <select
              id="meeting-base-tz"
              value={baseTz}
              onChange={(e) => setBaseTz(e.target.value)}
              className="bg-surface-muted/60 border-border h-10 rounded-lg border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {TIMEZONES.map((entry) => (
                <option key={entry.tz} value={entry.tz}>
                  {entry.label} ({entry.tz})
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="meeting-wall" className="text-muted-foreground text-xs">
              Proposed time
            </Label>
            <Input
              id="meeting-wall"
              type="datetime-local"
              value={wall}
              onChange={(e) => setWall(e.target.value)}
              leading={<AlarmClock aria-hidden />}
            />
          </div>

          <div className="text-muted-foreground ml-auto flex items-center gap-2 text-sm">
            <Users aria-hidden />
            <span>
              <span className="text-foreground font-semibold">{workingCount}</span>/
              {rows.length} participants in working hours
            </span>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <CalendarClock aria-hidden className="text-primary size-4" />
          <h3 className="text-sm font-medium">Participants</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {TIMEZONES.map((entry) => {
            const active = selected.has(entry.tz);
            return (
              <Button
                key={entry.tz}
                type="button"
                variant={active ? 'primary' : 'outline'}
                size="sm"
                onClick={() => toggle(entry.tz)}
                aria-pressed={active}
              >
                {entry.label}
              </Button>
            );
          })}
        </div>
      </Card>

      {rows.length > 0 ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rows.map(({ entry, info, dstSoon }) => (
              <Card
                key={entry.tz}
                className={cn(
                  'p-4 transition-colors',
                  info.isWorking ? 'border-success/40 bg-success/5' : '',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{entry.label}</p>
                    <p className="text-muted-foreground truncate text-xs">{entry.tz}</p>
                  </div>
                  <Badge variant={info.isWorking ? 'success' : 'neutral'}>
                    {info.isWorking ? 'Working' : 'Off hours'}
                  </Badge>
                </div>
                <p className="numeric mt-3 text-2xl font-semibold tabular-nums tracking-tight">
                  {info.label}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {info.date} · UTC{info.offsetLabel}
                  {dstSoon ? ' · DST change soon' : ''}
                </p>
              </Card>
            ))}
          </div>

          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Sunrise aria-hidden className="text-warning size-4" />
              <h3 className="text-sm font-medium">Best overlap hours (UTC)</h3>
              <span className="text-muted-foreground text-xs">
                on {date}, ranked by working participants
              </span>
            </div>
            <div className="space-y-2.5">
              {bestHours.map(({ utcHour, working }, index) => {
                const max = rows.length || 1;
                return (
                  <div key={utcHour} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-right text-xs tabular-nums">
                      {String(utcHour).padStart(2, '0')}:00
                    </span>
                    <div className="bg-surface-muted h-2 flex-1 overflow-hidden rounded-full">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          index === 0 ? 'bg-success' : 'bg-primary/70',
                        )}
                        style={{ width: `${(working / max) * 100}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground w-20 shrink-0 text-xs">
                      {working}/{rows.length} free
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">Select at least one participant above.</p>
      )}
    </div>
  );
}
