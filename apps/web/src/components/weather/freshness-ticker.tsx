'use client';

import { useEffect, useState } from 'react';

/**
 * Ticking "updated Xs ago" so the age of the on-screen data is always visible.
 * Pairs with the page-level AutoRefresh — after each refresh the server sends a
 * fresh `fetchedAt` once the upstream cache rolls over, and the counter restarts.
 */
export function FreshnessTicker({ fetchedAt }: { fetchedAt: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (now === null) return null;

  const ageS = Math.max(0, Math.round((now - new Date(fetchedAt).getTime()) / 1000));
  const label = ageS < 90 ? `${ageS}s` : `${Math.floor(ageS / 60)}m ${String(ageS % 60).padStart(2, '0')}s`;
  const stale = ageS > 660; // beyond one cache cycle (10 min) plus grace

  return (
    <span
      className={`flex items-center gap-1.5 text-xs ${stale ? 'text-amber-300' : 'text-muted-foreground'}`}
    >
      <span
        className={`inline-block size-1.5 rounded-full ${stale ? 'bg-amber-400' : 'animate-pulse bg-emerald-400'}`}
      />
      Updated {label} ago
    </span>
  );
}
