'use client';

import { featureFlagSchema, type FeatureFlag } from '@edt/shared';
import { Plus, Trash2, TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import type { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { api, describeError } from '@/lib/api/client';

type Audience = FeatureFlag['audience'][number];

const AUDIENCES: Audience[] = ['free', 'pro', 'team', 'enterprise', 'internal'];

function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root';
    if (out[key] === undefined) out[key] = issue.message;
  }
  return out;
}

export function FeatureFlagManager({ flags }: { flags: FeatureFlag[] }) {
  const router = useRouter();
  const [banner, setBanner] = React.useState<{ title: string; description: string } | null>(null);

  async function saveFlag(flag: FeatureFlag) {
    setBanner(null);
    try {
      await api<FeatureFlag>('/admin/feature-flags', { method: 'POST', body: flag });
      router.refresh();
    } catch (error) {
      setBanner(describeError(error));
    }
  }

  async function deleteFlag(key: string) {
    setBanner(null);
    try {
      await api<{ deleted: true }>(`/admin/system/feature-flags/${key}`, { method: 'DELETE' });
      router.refresh();
    } catch (error) {
      setBanner(describeError(error));
    }
  }

  return (
    <>
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

      <div className="mb-4 flex justify-end">
        <NewFlagDialog onCreated={() => router.refresh()} />
      </div>

      {flags.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="display-tight text-base">No feature flags yet</p>
          <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
            Create one to start a progressive rollout.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {flags.map((flag) => (
            <FlagCard key={flag.key} flag={flag} onSave={saveFlag} onDelete={deleteFlag} />
          ))}
        </div>
      )}
    </>
  );
}

function FlagCard({
  flag,
  onSave,
  onDelete,
}: {
  flag: FeatureFlag;
  onSave: (flag: FeatureFlag) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}) {
  const [enabled, setEnabled] = React.useState(flag.enabled);
  const [rollout, setRollout] = React.useState(flag.rollout);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function persist(next: Partial<FeatureFlag>) {
    setSaving(true);
    try {
      await onSave({ ...flag, enabled, rollout, ...next });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{flag.label}</p>
          <p className="text-muted-foreground truncate font-mono text-xs">{flag.key}</p>
        </div>
        <Switch
          checked={enabled}
          disabled={saving}
          onCheckedChange={(checked) => {
            setEnabled(checked);
            void persist({ enabled: checked });
          }}
          aria-label={`Toggle ${flag.label}`}
        />
      </div>

      <p className="text-muted-foreground mt-2 line-clamp-2 flex-1 text-xs leading-relaxed">
        {flag.description}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <Label htmlFor={`rollout-${flag.key}`} className="text-muted-foreground text-xs">
          Rollout
        </Label>
        <Input
          id={`rollout-${flag.key}`}
          type="number"
          min={0}
          max={100}
          value={rollout}
          disabled={saving}
          onChange={(event) => setRollout(Number(event.target.value))}
          onBlur={() => void persist({ rollout })}
          className="h-8 w-20 text-xs"
        />
        <span className="text-muted-foreground text-xs">%</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {flag.audience.map((audience) => (
          <Badge key={audience} variant="neutral" className="capitalize">
            {audience}
          </Badge>
        ))}
      </div>

      <Button
        variant="ghost"
        size="xs"
        className="text-destructive hover:bg-destructive/10 mt-3 self-end"
        loading={deleting}
        onClick={async () => {
          setDeleting(true);
          try {
            await onDelete(flag.key);
          } finally {
            setDeleting(false);
          }
        }}
      >
        <Trash2 />
        Delete
      </Button>
    </Card>
  );
}

function NewFlagDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [key, setKey] = React.useState('');
  const [label, setLabel] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [rollout, setRollout] = React.useState(0);
  const [audience, setAudience] = React.useState<Audience[]>(['internal']);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [banner, setBanner] = React.useState<{ title: string; description: string } | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  function toggleAudience(value: Audience) {
    setAudience((current) =>
      current.includes(value) ? current.filter((a) => a !== value) : [...current, value],
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setBanner(null);

    const parsed = featureFlagSchema.safeParse({
      key,
      label,
      description,
      enabled: false,
      rollout,
      audience,
    });

    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }

    setSubmitting(true);
    try {
      await api<FeatureFlag>('/admin/feature-flags', { method: 'POST', body: parsed.data });
      setOpen(false);
      setKey('');
      setLabel('');
      setDescription('');
      setRollout(0);
      setAudience(['internal']);
      onCreated();
    } catch (error) {
      setBanner(describeError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          New flag
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New feature flag</DialogTitle>
        </DialogHeader>
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
              <Label htmlFor="flag-key">Key</Label>
              <div className="mt-1.5">
                <Input
                  id="flag-key"
                  value={key}
                  onChange={(event) => setKey(event.target.value)}
                  invalid={Boolean(fieldErrors.key)}
                  placeholder="globe.time_machine"
                />
              </div>
              {fieldErrors.key ? (
                <p className="text-destructive mt-1.5 text-xs">{fieldErrors.key}</p>
              ) : null}
            </div>

            <div>
              <Label htmlFor="flag-label">Label</Label>
              <div className="mt-1.5">
                <Input
                  id="flag-label"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  invalid={Boolean(fieldErrors.label)}
                  placeholder="Globe time machine"
                />
              </div>
              {fieldErrors.label ? (
                <p className="text-destructive mt-1.5 text-xs">{fieldErrors.label}</p>
              ) : null}
            </div>

            <div>
              <Label htmlFor="flag-description">Description</Label>
              <div className="mt-1.5">
                <Input
                  id="flag-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  invalid={Boolean(fieldErrors.description)}
                  placeholder="What this flag controls"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="flag-rollout">Rollout %</Label>
              <div className="mt-1.5">
                <Input
                  id="flag-rollout"
                  type="number"
                  min={0}
                  max={100}
                  value={rollout}
                  onChange={(event) => setRollout(Number(event.target.value))}
                  invalid={Boolean(fieldErrors.rollout)}
                />
              </div>
            </div>

            <div>
              <Label>Audience</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {AUDIENCES.map((value) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-1.5 text-sm capitalize"
                  >
                    <input
                      type="checkbox"
                      checked={audience.includes(value)}
                      onChange={() => toggleAudience(value)}
                      className="accent-primary size-3.5"
                    />
                    {value}
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
          <DialogFooter>
            <Button type="submit" loading={submitting}>
              Create flag
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
