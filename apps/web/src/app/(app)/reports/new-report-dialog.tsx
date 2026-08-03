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
import { Input, Label } from '@/components/ui/input';
import { api, describeError } from '@/lib/api/client';

const KIND_OPTIONS = [
  { value: 'country_profile', label: 'Country profile' },
  { value: 'city_profile', label: 'City profile' },
  { value: 'area_summary', label: 'Area summary' },
  { value: 'environmental_risk', label: 'Environmental risk' },
  { value: 'climate_outlook', label: 'Climate outlook' },
  { value: 'comparison', label: 'Comparison' },
  { value: 'travel_plan', label: 'Travel plan' },
  { value: 'custom', label: 'Custom' },
] as const;

const FORMAT_OPTIONS = [
  { value: 'markdown', label: 'Markdown' },
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'Word (.docx)' },
] as const;

export function NewReportDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [kind, setKind] = React.useState<(typeof KIND_OPTIONS)[number]['value']>('country_profile');
  const [countryCode, setCountryCode] = React.useState('');
  const [format, setFormat] = React.useState<(typeof FORMAT_OPTIONS)[number]['value']>('markdown');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitting(true);
    try {
      await api('/reports', {
        method: 'POST',
        body: {
          kind,
          format,
          target: countryCode.trim()
            ? { countryCode: countryCode.trim().toUpperCase() }
            : { prompt: `A ${kind.replace(/_/g, ' ')} report` },
        },
      });
      toast.success('Report queued', { description: 'Generation runs in the background.' });
      setOpen(false);
      setCountryCode('');
      router.refresh();
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
          New report
        </Button>
      </DialogTrigger>
      <DialogContent size="sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New report</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 px-6 pb-2">
            <div className="space-y-1.5">
              <Label htmlFor="report-kind">Kind</Label>
              <select
                id="report-kind"
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

            <div className="space-y-1.5">
              <Label htmlFor="report-country">Country code (optional)</Label>
              <Input
                id="report-country"
                value={countryCode}
                onChange={(event) => setCountryCode(event.target.value)}
                placeholder="US"
                maxLength={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="report-format">Format</Label>
              <select
                id="report-format"
                value={format}
                onChange={(event) => setFormat(event.target.value as typeof format)}
                className="bg-surface-muted/60 border-border h-10 w-full rounded-lg border px-3 text-sm outline-none"
              >
                {FORMAT_OPTIONS.map((option) => (
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
              Generate report
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
