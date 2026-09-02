'use client';

import { useEffect, useState } from 'react';

const SYNC_S = 60;

/**
 * Live situation-room clock: local + UTC time ticking every second, plus the
 * countdown to the next AutoRefresh cycle (60 s) so the page visibly feels live.
 */
export function MissionClock() {
  const [now, setNow] = useState<Date | null>(null);
  const [syncIn, setSyncIn] = useState(SYNC_S);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => {
      setNow(new Date());
      setSyncIn((s) => (s <= 1 ? SYNC_S : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  return (
    <span className="text-muted-foreground flex items-center gap-2 text-xs">
      <span className="numeric">
        {now.toLocaleTimeString('en-GB')} local · {now.toUTCString().slice(17, 25)} UTC
      </span>
      <span aria-hidden className="text-muted-foreground/50">
        |
      </span>
      <span>next sync {syncIn}s</span>
    </span>
  );
}
