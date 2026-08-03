'use client';

import { Ban } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';

/** Revokes one API key after a confirm prompt, then refreshes the table. */
export function RevokeApiKeyButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function revoke() {
    if (!window.confirm(`Revoke the API key "${name}"? This cannot be undone.`)) return;
    setPending(true);
    try {
      await api(`/admin/system/api-keys/${id}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="xs"
      className="text-destructive"
      onClick={revoke}
      loading={pending}
    >
      <Ban />
      Revoke
    </Button>
  );
}
