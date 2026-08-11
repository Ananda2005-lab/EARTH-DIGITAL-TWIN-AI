'use client';

import { TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input, Label, Textarea } from '@/components/ui/input';
import { api, describeError } from '@/lib/api/client';
import { cn } from '@/lib/utils';

interface CityEditValues {
  summary: string;
  population: string;
  metroPopulation: string;
  timezone: string;
  isCapital: boolean;
  costOfLivingIndex: string;
  qualityOfLifeIndex: string;
  safetyIndex: string;
  averageAqi: string;
  wikipediaUrl: string;
}

interface Banner {
  title: string;
  description: string;
  tone: 'danger' | 'success';
}

interface CityCurationDialogProps {
  cityId: string;
  name: string;
}

function emptyValues(): CityEditValues {
  return {
    summary: '',
    population: '',
    metroPopulation: '',
    timezone: '',
    isCapital: false,
    costOfLivingIndex: '',
    qualityOfLifeIndex: '',
    safetyIndex: '',
    averageAqi: '',
    wikipediaUrl: '',
  };
}

/**
 * Curation dialog for a single city record. Loads the live city detail on
 * open and submits a partial PATCH to `/admin/cities/:id`, mirroring
 * `patchCitySchema` on the gateway.
 */
export function CityCurationDialog({ cityId, name }: CityCurationDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<CityEditValues>(emptyValues);
  const [loading, setLoading] = React.useState(false);
  const [banner, setBanner] = React.useState<Banner | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBanner(null);
    setLoading(true);
      api<{
        summary?: string | null;
        population?: number | null;
        metroPopulation?: number | null;
        costOfLivingIndex?: number | null;
        qualityOfLifeIndex?: number | null;
        safetyIndex?: number | null;
        averageAqi?: number | null;
        wikipediaUrl?: string | null;
        timezone?: string | null;
        isCapital?: boolean | null;
      }>(`/cities/${cityId}`)
      .then((detail) => {
        if (cancelled) return;
        setValues({
          summary: detail.summary ?? '',
          population: detail.population != null ? String(detail.population) : '',
          metroPopulation: detail.metroPopulation != null ? String(detail.metroPopulation) : '',
          timezone: detail.timezone ?? '',
          isCapital: detail.isCapital ?? false,
          costOfLivingIndex:
            detail.costOfLivingIndex != null ? String(detail.costOfLivingIndex) : '',
          qualityOfLifeIndex:
            detail.qualityOfLifeIndex != null ? String(detail.qualityOfLifeIndex) : '',
          safetyIndex: detail.safetyIndex != null ? String(detail.safetyIndex) : '',
          averageAqi: detail.averageAqi != null ? String(detail.averageAqi) : '',
          wikipediaUrl: detail.wikipediaUrl ?? '',
        });
      })
      .catch(() => {
        if (!cancelled) {
          setBanner({
            title: 'Could not load city',
            description: 'Open the detail page to verify the record, then try again.',
            tone: 'danger',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, cityId]);

  function update<K extends keyof CityEditValues>(key: K, value: CityEditValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBanner(null);

    const toNumberOrUndefined = (raw: string) => {
      if (raw.trim() === '') return undefined;
      const value = Number(raw);
      return Number.isFinite(value) ? value : undefined;
    };

    const payload: Record<string, unknown> = {};
    if (values.summary.trim() !== '') payload.summary = values.summary.trim();
    else payload.summary = null;

    const population = toNumberOrUndefined(values.population);
    if (population !== undefined) payload.population = population;

    const metroPopulation = toNumberOrUndefined(values.metroPopulation);
    payload.metroPopulation = metroPopulation ?? null;

    if (values.timezone.trim() !== '') payload.timezone = values.timezone.trim();

    payload.isCapital = values.isCapital;

    const costOfLivingIndex = toNumberOrUndefined(values.costOfLivingIndex);
    payload.costOfLivingIndex = costOfLivingIndex ?? null;

    const qualityOfLifeIndex = toNumberOrUndefined(values.qualityOfLifeIndex);
    payload.qualityOfLifeIndex = qualityOfLifeIndex ?? null;

    const safetyIndex = toNumberOrUndefined(values.safetyIndex);
    payload.safetyIndex = safetyIndex ?? null;

    const averageAqi = toNumberOrUndefined(values.averageAqi);
    payload.averageAqi = averageAqi ?? null;

    if (values.wikipediaUrl.trim() !== '') payload.wikipediaUrl = values.wikipediaUrl.trim();
    else payload.wikipediaUrl = null;

    setSubmitting(true);
    try {
      await api(`/admin/cities/${cityId}`, { method: 'PATCH', body: payload });
      setBanner({ title: 'City updated', description: 'Changes are now live.', tone: 'success' });
      setOpen(false);
      router.refresh();
    } catch (error) {
      const { title, description: message } = describeError(error);
      setBanner({ title, description: message, tone: 'danger' });
    } finally {
      setSubmitting(false);
    }
  }

  const numericFields: {
    key: 'population' | 'metroPopulation' | 'costOfLivingIndex' | 'qualityOfLifeIndex' | 'safetyIndex' | 'averageAqi';
    label: string;
  }[] = [
    { key: 'population', label: 'Population' },
    { key: 'metroPopulation', label: 'Metro population' },
    { key: 'costOfLivingIndex', label: 'Cost of living index' },
    { key: 'qualityOfLifeIndex', label: 'Quality of life index' },
    { key: 'safetyIndex', label: 'Safety index' },
    { key: 'averageAqi', label: 'Average AQI' },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Curate
        </Button>
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Curate · {name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading city record…</p>
          ) : (
            <>
          {banner ? (
            <div
              className={cn(
                'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
                banner.tone === 'danger'
                  ? 'border-destructive/40 bg-destructive/10 text-destructive'
                  : 'border-success/40 bg-success/10 text-success',
              )}
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div>
                <p className="font-medium">{banner.title}</p>
                <p className="text-muted-foreground">{banner.description}</p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="city-summary">Summary</Label>
              <div className="mt-1.5">
                <Textarea
                  id="city-summary"
                  value={values.summary}
                  onChange={(event) => update('summary', event.target.value)}
                  placeholder="Short description of the city."
                />
              </div>
            </div>

            {numericFields.map(({ key, label }) => (
              <div key={key}>
                <Label htmlFor={`city-${key}`}>{label}</Label>
                <div className="mt-1.5">
                  <Input
                    id={`city-${key}`}
                    type="number"
                    min={0}
                    value={values[key]}
                    onChange={(event) => update(key, event.target.value)}
                  />
                </div>
              </div>
            ))}

            <div>
              <Label htmlFor="city-timezone">Timezone</Label>
              <div className="mt-1.5">
                <Input
                  id="city-timezone"
                  value={values.timezone}
                  onChange={(event) => update('timezone', event.target.value)}
                  placeholder="Asia/Tokyo"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="city-wikipedia">Wikipedia URL</Label>
              <div className="mt-1.5">
                <Input
                  id="city-wikipedia"
                  type="url"
                  value={values.wikipediaUrl}
                  onChange={(event) => update('wikipediaUrl', event.target.value)}
                />
              </div>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={values.isCapital}
                onChange={(event) => update('isCapital', event.target.checked)}
                className="accent-primary size-4"
              />
              <span className="text-sm">Capital city</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Save changes
            </Button>
          </div>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
