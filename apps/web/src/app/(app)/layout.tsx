import type * as React from 'react';

import { AppShell } from '@/components/layout/app-shell';

/**
 * Wraps every product route in the persistent chrome. The marketing landing page
 * sits outside this group so it can own the full viewport.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
