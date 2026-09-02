'use client';

import type { WeatherHourly } from '@edt/shared';
import {
  Area,
  Bar,
  ComposedChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * 24-hour temperature curve with rain-probability bars behind it.
 * Client-only because recharts measures the DOM on mount.
 */
export function HourlyTrendChart({ hours }: { hours: WeatherHourly[] }) {
  const data = hours.map((hour) => ({
    time: new Date(hour.time).toLocaleTimeString('en-GB', { hour: '2-digit' }),
    temp: Math.round(hour.temperature * 10) / 10,
    rain: hour.precipitationProbability ?? 0,
  }));

  // Contiguous night spans (isDay === false) rendered as shaded bands.
  const nightSpans: { start: string; end: string }[] = [];
  let spanStart: string | null = null;
  hours.forEach((hour, index) => {
    const label = data[index]?.time ?? '';
    if (!hour.isDay && spanStart === null) spanStart = label;
    if (hour.isDay && spanStart !== null) {
      nightSpans.push({ start: spanStart, end: data[index - 1]?.time ?? spanStart });
      spanStart = null;
    }
  });
  if (spanStart !== null && data.length > 0) {
    nightSpans.push({ start: spanStart, end: data[data.length - 1]?.time ?? spanStart });
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 0, left: -18, bottom: 0 }}>
          <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={3} stroke="currentColor" />
          <YAxis yAxisId="temp" tick={{ fontSize: 10 }} stroke="currentColor" width={42} />
          <YAxis
            yAxisId="rain"
            orientation="right"
            domain={[0, 100]}
            tick={{ fontSize: 10 }}
            stroke="currentColor"
            width={34}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(222 47% 6%)',
              border: '1px solid hsl(217 33% 17%)',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: 'hsl(210 20% 70%)' }}
          />
          <Bar yAxisId="rain" dataKey="rain" name="Rain %" fill="#38bdf8" opacity={0.3} radius={[3, 3, 0, 0]} />
          {nightSpans.map((span) => (
            <ReferenceArea
              key={span.start}
              yAxisId="temp"
              x1={span.start}
              x2={span.end}
              fill="#020617"
              fillOpacity={0.5}
              strokeOpacity={0}
            />
          ))}
          <Area
            yAxisId="temp"
            type="monotone"
            dataKey="temp"
            name="°C"
            stroke="#22d3ee"
            strokeWidth={2}
            fill="#22d3ee"
            fillOpacity={0.15}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-muted-foreground mt-2 text-xs">
        Shaded bands mark night hours — plan outdoor activity in the clear zone.
      </p>
    </div>
  );
}
