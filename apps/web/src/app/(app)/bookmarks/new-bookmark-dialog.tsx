'use client';

import type { BookmarkCollection } from '@edt/shared';
import { Plus } from 'lucide-react';
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
import { Input, Label } from '@/components/ui/input';
import { api, describeError } from '@/lib/api/client';

const KIND_OPTIONS = [
  { value: 'place', label: 'Place' },
  { value: 'view', label: 'View' },
  { value: 'area', label: 'Area' },
  { value: 'route', label: 'Route' },
] as const;

/**
 * Minimal creation form. The bookmark's centre coordinate normally comes from
 * wherever the user clicked on the globe; this dialog is a best-effort entry
 * point until that flow exists, so it defaults to 0,0 rather than exposing raw
 * lng/lat inputs.
 */
export function NewBookmarkDialog({ collections }: { collections: BookmarkCollection[] }) {
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [name, setName] = React.useState('');
  const [kind, setKind] = React.useState<(typeof KIND_OPTIONS)[number]['value']>('place');
  const [color, setColor] = React.useState('#38bdf8');
  const [collectionId, setCollectionId] = React.useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      await api('/bookmarks', {
        method: 'POST',
        body: {
          name: name.trim(),
          kind,
          color,
          center: { lng: 0, lat: 0 },
          collectionId: collectionId || undefined,
        },
      });
      toast.success('Bookmark saved');
      setOpen(false);
      setName('');
      setKind('place');
      setColor('#38bdf8');
      setCollectionId('');
    } catch (error) {
      const { title, description } = describeError(error);
      toast.error(title, { description });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          New bookmark
        </Button>
      </DialogTrigger>
      <DialogContent size="sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New bookmark</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 px-6 pb-2">
            <div className="space-y-1.5">
              <Label htmlFor="bookmark-name">Name</Label>
              <Input
                id="bookmark-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Kathmandu Valley"
                maxLength={120}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bookmark-kind">Kind</Label>
              <select
                id="bookmark-kind"
                value={kind}
                onChange={(event) => setKind(event.target.value as typeof kind)}
                className="bg-surface-muted/60 border-border h-10 w-full rounded-lg border px-3 text-sm outline-none"
              >
                {KIND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {collections.length > 0 ? (
              <div className="space-y-1.5">
                <Label htmlFor="bookmark-collection">Collection</Label>
                <select
                  id="bookmark-collection"
                  value={collectionId}
                  onChange={(event) => setCollectionId(event.target.value)}
                  className="bg-surface-muted/60 border-border h-10 w-full rounded-lg border px-3 text-sm outline-none"
                >
                  <option value="">Uncategorised</option>
                  {collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="bookmark-color">Colour</Label>
              <Input
                id="bookmark-color"
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="h-10 w-16 cursor-pointer p-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Save bookmark
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
