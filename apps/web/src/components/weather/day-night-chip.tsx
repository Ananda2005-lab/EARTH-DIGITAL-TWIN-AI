'use client';

import { useEffect, useMemo, useState } from 'react';
import { MoonStar, Sun } from 'lucide-react';

/**
 * Day/night chip derived from the city's own sunrise/sunset times, re-evaluated
 * every second on the client. Immune to the 10-minute upstream cache: the chip
 * flips exactly at sunrise/sunset even when the cached "current" payload is a
 * few minutes old. Falls back to the server-provided is_day before hydration.
 */
export function DayNightChip({
  sunrise,
  sunset,
  timezone,
  fallbackIsDay,
}: {
  sunrise: string;
  sunset: string;
  timezone: string;
  fallbackIsDay: boolean;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const isDay = useMemo(() => {
    if (now === null) return fallbackIsDay;
    // Open-Meteo sunrise/sunset are timezone-less wall-clock strings in the
    // city's local time — parse them as naive wall clock and compare against
    // "now" expressed as the city's wall clock too, so the viewer's own
    // timezone never distorts the comparison.
    const sr = Date.parse(sunrise);
    const ss = Date.parse(sunset);
    if (!Number.isFinite(sr) || !Number.isFinite(ss) || ss <= sr) return fallbackIsDay;
    let cityNow: number;
    try {
      cityNow = new Date(new Date(now).toLocaleString('en-US', { timeZone: timezone })).getTime();
    } catch {
      return fallbackIsDay;
    }
    return cityNow >= sr && cityNow < ss;
  }, [now, sunrise, sunset, timezone, fallbackIsDay]);

  return (
    <span className="text-muted-foreground ml-auto flex items-center gap-1.5 text-sm">
      {isDay ? (
        <Sun className="text-amber-300 size-4" aria-hidden />
      ) : (
        <MoonStar className="text-indigo-300 size-4" aria-hidden />
      )}
      {isDay ? 'Daytime now' : 'Night now'}
    </span>
  );
}
