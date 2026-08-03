'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Label } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api/client';

interface MaintenanceState {
  enabled: boolean;
  message: string | null;
  since: string | null;
}

/**
 * Owner-only maintenance mode toggle. While enabled, non-admin write requests
 * are rejected with 503 across every gateway instance, so flipping it on is
 * confirmed before the request goes out.
 */
export function MaintenanceToggle({ initial }: { initial: MaintenanceState }) {
  const router = useRouter();
  const [enabled, setEnabled] = React.useState(initial.enabled);
  const [pending, setPending] = React.useState(false);

  async function toggle(next: boolean) {
    if (
      next &&
      !window.confirm(
        'Enable maintenance mode? Non-admin write requests will be rejected across the platform.',
      )
    ) {
      return;
    }
    setPending(true);
    try {
      const state = await api<MaintenanceState>('/admin/system/maintenance', {
        method: 'POST',
        body: { enabled: next },
      });
      setEnabled(state.enabled);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <Label htmlFor="maintenance-toggle">Maintenance mode</Label>
        <p className="text-muted-foreground text-xs">
          Requires owner role. Rejects non-admin writes across every instance while enabled.
        </p>
      </div>
      <Switch
        id="maintenance-toggle"
        checked={enabled}
        disabled={pending}
        onCheckedChange={toggle}
      />
    </div>
  );
}
