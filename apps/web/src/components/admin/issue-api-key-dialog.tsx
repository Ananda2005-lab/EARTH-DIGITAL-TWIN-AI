'use client';

import type { ApiKeyRecord } from '@edt/shared';
import { Check, Copy, Plus, TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/input';
import { api, describeError } from '@/lib/api/client';

/**
 * Issues a new API key. The response secret is only ever shown once, so the
 * dialog switches into a "reveal" state after a successful issue and blocks
 * the close affordance's usual reset until the admin has copied it.
 */
export function IssueApiKeyDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [scopesInput, setScopesInput] = React.useState('');
  const [rateLimitPerMinute, setRateLimitPerMinute] = React.useState(120);
  const [expiresInDays, setExpiresInDays] = React.useState('');
  const [banner, setBanner] = React.useState<{ title: string; description: string } | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [issued, setIssued] = React.useState<{ record: ApiKeyRecord; secret: string } | null>(null);
  const [copied, setCopied] = React.useState(false);

  function reset() {
    setName('');
    setScopesInput('');
    setRateLimitPerMinute(120);
    setExpiresInDays('');
    setBanner(null);
    setIssued(null);
    setCopied(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBanner(null);

    const scopes = scopesInput
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean);

    if (name.trim().length < 2 || scopes.length === 0) {
      setBanner({
        title: 'Check your input',
        description: 'Name (2+ chars) and at least one scope are required.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const result = await api<{ record: ApiKeyRecord; secret: string }>('/admin/system/api-keys', {
        method: 'POST',
        body: {
          name: name.trim(),
          scopes,
          rateLimitPerMinute,
          expiresInDays: expiresInDays.trim() === '' ? undefined : Number(expiresInDays),
        },
      });
      setIssued(result);
      router.refresh();
    } catch (error) {
      setBanner(describeError(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function copySecret() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.secret);
      setCopied(true);
    } catch {
      setBanner({ title: 'Copy failed', description: 'Select and copy the secret manually.' });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          Issue new key
        </Button>
      </DialogTrigger>
      <DialogContent hideClose={issued === null ? false : true}>
        <DialogHeader>
          <DialogTitle>{issued ? 'Key issued' : 'Issue new API key'}</DialogTitle>
        </DialogHeader>

        {issued ? (
          <CardContent className="space-y-4 pt-0">
            <div
              role="alert"
              className="border-warning/30 bg-warning/10 text-warning flex items-start gap-3 rounded-xl border p-3 text-sm"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div>
                <p className="font-medium">This secret will not be shown again</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Copy it now and store it somewhere safe.
                </p>
              </div>
            </div>

            <div>
              <Label>Secret</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <Input readOnly value={issued.secret} className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={copySecret}
                  aria-label="Copy secret"
                >
                  {copied ? <Check className="text-success" /> : <Copy />}
                </Button>
              </div>
            </div>

            <p className="text-muted-foreground text-xs">
              Name: {issued.record.name} · Suffix ••••{issued.record.suffix}
            </p>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 pt-0">
              {banner ? (
                <div
                  role="alert"
                  className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-3 rounded-xl border p-3 text-sm"
                >
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <div>
                    <p className="font-medium">{banner.title}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">{banner.description}</p>
                  </div>
                </div>
              ) : null}

              <div>
                <Label htmlFor="key-name">Name</Label>
                <div className="mt-1.5">
                  <Input
                    id="key-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Partner integration"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="key-scopes">Scopes (comma-separated)</Label>
                <div className="mt-1.5">
                  <Input
                    id="key-scopes"
                    value={scopesInput}
                    onChange={(event) => setScopesInput(event.target.value)}
                    placeholder="hazards:read, flights:read"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="key-rate-limit">Rate limit / min</Label>
                  <div className="mt-1.5">
                    <Input
                      id="key-rate-limit"
                      type="number"
                      min={1}
                      max={10000}
                      value={rateLimitPerMinute}
                      onChange={(event) => setRateLimitPerMinute(Number(event.target.value))}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="key-expires">Expires in days (optional)</Label>
                  <div className="mt-1.5">
                    <Input
                      id="key-expires"
                      type="number"
                      min={1}
                      max={3650}
                      value={expiresInDays}
                      onChange={(event) => setExpiresInDays(event.target.value)}
                      placeholder="Never"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
            <DialogFooter>
              <Button type="submit" loading={submitting}>
                Issue key
              </Button>
            </DialogFooter>
          </form>
        )}

        {issued ? (
          <DialogFooter>
            <Button
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Done
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
