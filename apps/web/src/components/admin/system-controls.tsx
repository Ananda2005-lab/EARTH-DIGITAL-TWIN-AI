'use client';

import { RotateCcw, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { api } from '@/lib/api/client';

/** Closes upstream circuit breakers, optionally scoped to one provider. */
export function ResetCircuitsButton() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [reset, setReset] = React.useState<string[] | null>(null);

  async function handleReset() {
    setPending(true);
    try {
      const result = await api<{ reset: string[] }>('/admin/system/circuits/reset', {
        method: 'POST',
      });
      setReset(result.reset);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-5">
      <CardHeader className="p-0 pb-3">
        <CardTitle className="text-sm">Circuit breakers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-0">
        <p className="text-muted-foreground text-xs">
          Close every open upstream circuit breaker so the next request retries immediately.
        </p>
        <Button variant="outline" size="sm" onClick={handleReset} loading={pending}>
          <RotateCcw />
          Reset circuit breakers
        </Button>
        {reset ? (
          <p className="text-muted-foreground text-xs">
            Reset: {reset.length > 0 ? reset.join(', ') : 'none'}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Clears cached upstream payloads, optionally scoped to one provider namespace. */
export function ClearCacheForm() {
  const router = useRouter();
  const [provider, setProvider] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [removed, setRemoved] = React.useState<number | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await api<{ removed: number }>('/admin/system/cache/invalidate', {
        method: 'POST',
        body: { provider: provider.trim() === '' ? undefined : provider.trim() },
      });
      setRemoved(result.removed);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-5">
      <CardHeader className="p-0 pb-3">
        <CardTitle className="text-sm">Clear cache</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-0">
        <p className="text-muted-foreground text-xs">
          Leave the provider blank to clear every cached HTTP response.
        </p>
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="cache-provider" className="text-muted-foreground text-xs">
              Provider (optional)
            </Label>
            <div className="mt-1.5">
              <Input
                id="cache-provider"
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
                placeholder="e.g. hazards"
              />
            </div>
          </div>
          <Button type="submit" variant="outline" size="sm" loading={pending}>
            <Trash2 />
            Clear
          </Button>
        </form>
        {removed !== null ? (
          <p className="text-muted-foreground text-xs">Removed {removed} cached keys.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
