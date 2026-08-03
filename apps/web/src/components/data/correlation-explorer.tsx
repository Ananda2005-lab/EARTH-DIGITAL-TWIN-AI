'use client';

import * as React from 'react';
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

import { formatIndicatorValue } from '@/components/data/indicator-format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { pearson } from '@/lib/utils';

export interface CorrelationRow {
  code: string;
  name: string;
  flagEmoji: string;
  continent: string;
  x: number;
  y: number;
  xYear: number;
  yYear: number;
}

/**
 * Scatter chart plus a sortable backing table — the chart gives the shape of
 * the relationship at a glance, the table gives exact values per territory.
 */
export function CorrelationExplorer({
  rows,
  xLabel,
  yLabel,
  xUnit,
  yUnit,
}: {
  rows: CorrelationRow[];
  xLabel: string;
  yLabel: string;
  xUnit: string;
  yUnit: string;
}) {
  const [sortBy, setSortBy] = React.useState<'x' | 'y' | 'name'>('x');

  const r = React.useMemo(
    () =>
      pearson(
        rows.map((row) => row.x),
        rows.map((row) => row.y),
      ),
    [rows],
  );

  const sortedRows = React.useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return b[sortBy] - a[sortBy];
    });
    return copy;
  }, [rows, sortBy]);

  if (rows.length === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="display-tight text-base">No overlapping data</p>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
          Neither indicator has recent values for a shared set of territories.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>
            {xLabel} vs {yLabel}
          </CardTitle>
          <p className="text-muted-foreground mt-1 text-xs">
            {rows.length} territories with data for both indicators · Pearson r = {r.toFixed(2)}
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis
                type="number"
                dataKey="x"
                name={xLabel}
                tick={{ fontSize: 11 }}
                tickFormatter={(value: number) => formatIndicatorValue(value, xUnit)}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={yLabel}
                tick={{ fontSize: 11 }}
                tickFormatter={(value: number) => formatIndicatorValue(value, yUnit)}
              />
              <ZAxis range={[60, 60]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload as CorrelationRow | undefined;
                  if (!row) return null;
                  return (
                    <div className="glass rounded-lg px-3 py-2 text-xs shadow-lg">
                      <p className="font-medium">
                        {row.flagEmoji} {row.name}
                      </p>
                      <p className="text-muted-foreground mt-1">
                        {xLabel}: {formatIndicatorValue(row.x, xUnit)}
                      </p>
                      <p className="text-muted-foreground">
                        {yLabel}: {formatIndicatorValue(row.y, yUnit)}
                      </p>
                    </div>
                  );
                }}
              />
              <Scatter data={rows} fill="hsl(var(--primary))" fillOpacity={0.75} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-border/60 border-b text-left text-xs">
                <th className="py-2 pr-2 font-medium">
                  <SortButton active={sortBy === 'name'} onClick={() => setSortBy('name')}>
                    Territory
                  </SortButton>
                </th>
                <th className="py-2 pr-2 text-right font-medium">
                  <SortButton active={sortBy === 'x'} onClick={() => setSortBy('x')}>
                    {xLabel}
                  </SortButton>
                </th>
                <th className="py-2 pl-2 text-right font-medium">
                  <SortButton active={sortBy === 'y'} onClick={() => setSortBy('y')}>
                    {yLabel}
                  </SortButton>
                </th>
              </tr>
            </thead>
            <tbody className="divide-border/60 divide-y">
              {sortedRows.slice(0, 40).map((row) => (
                <tr key={row.code}>
                  <td className="py-2 pr-2">
                    <span className="mr-1.5" aria-hidden>
                      {row.flagEmoji}
                    </span>
                    {row.name}
                  </td>
                  <td className="numeric py-2 pr-2 text-right">
                    {formatIndicatorValue(row.x, xUnit)}
                  </td>
                  <td className="numeric py-2 pl-2 text-right">
                    {formatIndicatorValue(row.y, yUnit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sortedRows.length > 40 ? (
            <p className="text-muted-foreground mt-3 text-center text-xs">
              Showing 40 of {sortedRows.length} territories.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function SortButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? 'text-foreground' : 'hover:text-foreground transition-colors'}
    >
      {children}
    </button>
  );
}
