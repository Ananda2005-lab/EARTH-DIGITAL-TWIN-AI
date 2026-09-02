'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Wraps Mission Control with periodic server-side revalidation.
 *
 * The parent server component re-executes on every refresh, producing fresh
 * stat values, event lists and timestamps. The client interval is 60 s — fast
 * enough for a live "situation room" without hammering upstream providers
 * (all responses are TTL-cached server-side).
 */
export function AutoRefresh({ children, intervalMs = 60_000 }: { children?: React.ReactNode; intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return <>{children}</>;
}
