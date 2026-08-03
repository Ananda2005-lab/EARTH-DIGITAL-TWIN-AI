'use client';

import { broadcastNotificationSchema } from '@edt/shared';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import * as React from 'react';
import type { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Label, Textarea } from '@/components/ui/input';
import { api, describeError } from '@/lib/api/client';
import { cn } from '@/lib/utils';

type Kind = 'hazard' | 'report' | 'system' | 'ai' | 'billing' | 'security';
type Severity = 'info' | 'success' | 'warning' | 'critical';
type Audience = 'all' | 'free' | 'pro' | 'team' | 'enterprise' | 'admins';

const KINDS: Kind[] = ['hazard', 'report', 'system', 'ai', 'billing', 'security'];
const SEVERITIES: Severity[] = ['info', 'success', 'warning', 'critical'];
const AUDIENCES: Audience[] = ['all', 'free', 'pro', 'team', 'enterprise', 'admins'];

function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root';
    if (out[key] === undefined) out[key] = issue.message;
  }
  return out;
}

/** Native `<select>` styled to match `Input`, since there is no Select primitive yet. */
function SelectField({
  id,
  value,
  onChange,
  children,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        'bg-surface-muted/60 border-border h-10 w-full rounded-lg border px-3 text-sm',
        'focus-visible:border-primary/60 focus-visible:ring-ring/40 outline-none focus-visible:ring-2',
      )}
    >
      {children}
    </select>
  );
}

export function BroadcastForm() {
  const [kind, setKind] = React.useState<Kind>('system');
  const [severity, setSeverity] = React.useState<Severity>('info');
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [actionUrl, setActionUrl] = React.useState('');
  const [audience, setAudience] = React.useState<Audience>('all');
  const [scheduledFor, setScheduledFor] = React.useState('');
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [banner, setBanner] = React.useState<{ title: string; description: string } | null>(null);
  const [success, setSuccess] = React.useState<{ recipients: number; scheduled: boolean } | null>(
    null,
  );
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setBanner(null);
    setSuccess(null);

    const parsed = broadcastNotificationSchema.safeParse({
      kind,
      severity,
      title,
      body,
      actionUrl: actionUrl.trim() === '' ? undefined : actionUrl.trim(),
      audience,
      scheduledFor: scheduledFor.trim() === '' ? undefined : new Date(scheduledFor).toISOString(),
    });

    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }

    setSubmitting(true);
    try {
      const result = await api<{ recipients: number; scheduled: boolean }>(
        '/admin/notifications/broadcast',
        { method: 'POST', body: parsed.data },
      );
      setSuccess(result);
      setTitle('');
      setBody('');
      setActionUrl('');
      setScheduledFor('');
    } catch (error) {
      setBanner(describeError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="max-w-2xl p-6">
      {success ? (
        <div
          role="status"
          className="border-success/30 bg-success/10 text-success mb-5 flex items-start gap-3 rounded-xl border p-3 text-sm"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">
              {success.scheduled ? 'Broadcast scheduled' : 'Broadcast sent'}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {success.recipients} recipient{success.recipients === 1 ? '' : 's'}
              {success.scheduled ? ' will receive it at the scheduled time.' : '.'}
            </p>
          </div>
        </div>
      ) : null}

      {banner ? (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive mb-5 flex items-start gap-3 rounded-xl border p-3 text-sm"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">{banner.title}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">{banner.description}</p>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="kind">Kind</Label>
            <div className="mt-1.5">
              <SelectField id="kind" value={kind} onChange={(value) => setKind(value as Kind)}>
                {KINDS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>

          <div>
            <Label htmlFor="severity">Severity</Label>
            <div className="mt-1.5">
              <SelectField
                id="severity"
                value={severity}
                onChange={(value) => setSeverity(value as Severity)}
              >
                {SEVERITIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="title">Title</Label>
          <div className="mt-1.5">
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              invalid={Boolean(fieldErrors.title)}
              placeholder="Scheduled maintenance tonight"
            />
          </div>
          {fieldErrors.title ? (
            <p className="text-destructive mt-1.5 text-xs">{fieldErrors.title}</p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="body">Body</Label>
          <div className="mt-1.5">
            <Textarea
              id="body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              invalid={Boolean(fieldErrors.body)}
              placeholder="Give people enough detail to act on this."
              rows={4}
            />
          </div>
          {fieldErrors.body ? (
            <p className="text-destructive mt-1.5 text-xs">{fieldErrors.body}</p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="actionUrl">Action URL (optional)</Label>
          <div className="mt-1.5">
            <Input
              id="actionUrl"
              value={actionUrl}
              onChange={(event) => setActionUrl(event.target.value)}
              invalid={Boolean(fieldErrors.actionUrl)}
              placeholder="https://example.com/status"
            />
          </div>
          {fieldErrors.actionUrl ? (
            <p className="text-destructive mt-1.5 text-xs">{fieldErrors.actionUrl}</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="audience">Audience</Label>
            <div className="mt-1.5">
              <SelectField
                id="audience"
                value={audience}
                onChange={(value) => setAudience(value as Audience)}
              >
                {AUDIENCES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>

          <div>
            <Label htmlFor="scheduledFor">Schedule for (optional)</Label>
            <div className="mt-1.5">
              <Input
                id="scheduledFor"
                type="datetime-local"
                value={scheduledFor}
                onChange={(event) => setScheduledFor(event.target.value)}
                invalid={Boolean(fieldErrors.scheduledFor)}
              />
            </div>
          </div>
        </div>

        <Button type="submit" loading={submitting}>
          {scheduledFor.trim() === '' ? 'Send broadcast' : 'Schedule broadcast'}
        </Button>
      </form>
    </Card>
  );
}
