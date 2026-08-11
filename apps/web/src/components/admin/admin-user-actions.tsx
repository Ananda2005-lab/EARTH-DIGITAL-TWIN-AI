'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { api, describeError } from '@/lib/api/client';

const ROLES = ['user', 'analyst', 'admin', 'owner'] as const;
const PLANS = ['free', 'pro', 'team', 'enterprise'] as const;

/**
 * Inline role / plan / suspension controls for one admin user row. Every
 * change PATCHes the gateway immediately; owner rows are guarded server-side
 * (only an owner can manage owners).
 */
export function AdminUserActions({
  userId,
  role,
  plan,
  suspended,
}: {
  userId: string;
  role: string;
  plan: string;
  suspended: boolean;
}) {
  const [busy, setBusy] = React.useState(false);
  const router = useRouter();

  async function update(payload: { role?: string; plan?: string; suspended?: boolean }) {
    setBusy(true);
    try {
      await api(`/admin/users/${userId}`, { method: 'PATCH', body: payload });
      toast.success('User updated');
      router.refresh();
    } catch (error) {
      const { title, description: message } = describeError(error);
      toast.error(title, { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        aria-label="Role"
        disabled={busy}
        value={role}
        onChange={(event) => update({ role: event.target.value })}
        className="bg-surface-muted/60 border-border h-8 rounded-md border px-2 text-xs outline-none disabled:opacity-50"
      >
        {ROLES.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <select
        aria-label="Plan"
        disabled={busy}
        value={plan}
        onChange={(event) => update({ plan: event.target.value })}
        className="bg-surface-muted/60 border-border h-8 rounded-md border px-2 text-xs outline-none disabled:opacity-50"
      >
        {PLANS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => update({ suspended: !suspended })}
      >
        {suspended ? 'Reinstate' : 'Suspend'}
      </Button>
    </div>
  );
}
