'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input, Label, Textarea } from '@/components/ui/input';
import { api, describeError } from '@/lib/api/client';

const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Private' },
  { value: 'team', label: 'Team' },
  { value: 'public', label: 'Public' },
] as const;

/** A neutral world view, used until this dialog can capture the globe's live camera. */
const DEFAULT_VIEW = { lng: 0, lat: 0, altitude: 20_000_000, bearing: 0, pitch: 0 };

export function NewWorkspaceDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [visibility, setVisibility] =
    React.useState<(typeof VISIBILITY_OPTIONS)[number]['value']>('private');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      await api('/workspaces', {
        method: 'POST',
        body: {
          name: name.trim(),
          description: description.trim() || undefined,
          view: DEFAULT_VIEW,
          visibility,
        },
      });
      toast.success('Workspace created');
      setOpen(false);
      setName('');
      setDescription('');
      setVisibility('private');
      router.refresh();
    } catch (error) {
      const { title, description: message } = describeError(error);
      toast.error(title, { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          New workspace
        </Button>
      </DialogTrigger>
      <DialogContent size="sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New workspace</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 px-6 pb-2">
            <div className="space-y-1.5">
              <Label htmlFor="workspace-name">Name</Label>
              <Input
                id="workspace-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Pacific storm tracking"
                maxLength={120}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="workspace-description">Description</Label>
              <Textarea
                id="workspace-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What this scene is for"
                maxLength={2000}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="workspace-visibility">Visibility</Label>
              <select
                id="workspace-visibility"
                value={visibility}
                onChange={(event) => setVisibility(event.target.value as typeof visibility)}
                className="bg-surface-muted/60 border-border h-10 w-full rounded-lg border px-3 text-sm outline-none"
              >
                {VISIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Create workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
