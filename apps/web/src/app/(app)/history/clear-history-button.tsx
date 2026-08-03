'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { api, describeError } from '@/lib/api/client';

export function ClearHistoryButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);

  async function handleConfirm() {
    setClearing(true);
    try {
      await api('/users/me/history', { method: 'DELETE' });
      toast.success('History cleared');
      setOpen(false);
      router.refresh();
    } catch (error) {
      const { title, description } = describeError(error);
      toast.error(title, { description });
    } finally {
      setClearing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Trash2 />
          Clear history
        </Button>
      </DialogTrigger>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Clear all history?</DialogTitle>
          <DialogDescription>
            This removes every recorded search, place, report and layer visit. It cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" loading={clearing} onClick={handleConfirm}>
            Clear history
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
