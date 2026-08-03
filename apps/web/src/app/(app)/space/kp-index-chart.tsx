'use client';

import { formatDateTime } from '@edt/shared';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface KpPoint {
  time: string;
  kp: number;
}

/** Bars colour by disturbance level so a storm period stands out at a glance. */
function barColor(kp: number): string {
  if (kp >= 7) return 'hsl(var(--destructive))';
  if (kp >= 5) return 'hsl(var(--warning))';
  return 'hsl(var(--primary))';
}

export function KpIndexChart({ series }: { series: KpPoint[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: string) =>
              new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit' })
            }
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            domain={[0, 9]}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={28}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--surface-muted))' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0]?.payload as KpPoint | undefined;
              if (!point) return null;
              return (
                <div className="glass rounded-lg px-3 py-2 text-xs shadow-lg">
                  <p className="font-medium">{formatDateTime(point.time)}</p>
                  <p className="text-muted-foreground mt-1">Kp {point.kp.toFixed(1)}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="kp" radius={[2, 2, 0, 0]}>
            {series.map((point) => (
              <Cell key={point.time} fill={barColor(point.kp)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
