'use client';

import { Flag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';

/**
 * Toggles the moderation flag on one AI usage log entry. Optimistically
 * updates its own label, then asks the server component to re-fetch so the
 * badge in the table row reflects the persisted state.
 */
export function AiLogFlagButton({ id, flagged }: { id: string; flagged: boolean }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [optimistic, setOptimistic] = React.useState(flagged);

  async function toggle() {
    const next = !optimistic;
    setOptimistic(next);
    setPending(true);
    try {
      await api<{ flagged: boolean }>(`/admin/ai-logs/${id}/flag`, {
        method: 'POST',
        body: { flagged: next },
      });
      router.refresh();
    } catch {
      setOptimistic(!next);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant={optimistic ? 'destructive' : 'outline'}
      size="xs"
      onClick={toggle}
      loading={pending}
    >
      <Flag />
      {optimistic ? 'Unflag' : 'Flag'}
    </Button>
  );
}
