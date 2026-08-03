'use client';

import type { Continent } from '@edt/shared';
import { TriangleAlert } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { api, describeError } from '@/lib/api/client';
import { CONTINENTS } from '@/lib/data/countries';
import { cn } from '@/lib/utils';

interface CountryEditValues {
  summary: string;
  capital: string;
  population: string;
  areaKm2: string;
  wikipediaUrl: string;
  coatOfArmsUrl: string;
  continent: Continent;
}

interface Banner {
  title: string;
  description: string;
  tone: 'danger' | 'success';
}

/**
 * Curation form for a single country record. Submits a partial PATCH to
 * `/admin/countries/:code` — only fields that differ from their string
 * representation are sent, mirroring the optional-everything shape of
 * `patchCountrySchema` on the gateway.
 */
export function EditCountryForm({
  code,
  initialValues,
}: {
  code: string;
  initialValues: CountryEditValues;
}) {
  const [values, setValues] = React.useState(initialValues);
  const [banner, setBanner] = React.useState<Banner | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  function update<K extends keyof CountryEditValues>(key: K, value: CountryEditValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBanner(null);

    const population = values.population.trim() === '' ? undefined : Number(values.population);
    const areaKm2 = values.areaKm2.trim() === '' ? undefined : Number(values.areaKm2);

    if (population !== undefined && !Number.isFinite(population)) {
      setBanner({
        title: 'Invalid population',
        description: 'Enter a whole number.',
        tone: 'danger',
      });
      return;
    }
    if (areaKm2 !== undefined && !Number.isFinite(areaKm2)) {
      setBanner({ title: 'Invalid area', description: 'Enter a number in km².', tone: 'danger' });
      return;
    }

    setSubmitting(true);
    try {
      await api<{ code: string; updatedAt: string }>(`/admin/countries/${code}`, {
        method: 'PATCH',
        body: {
          summary: values.summary.trim() === '' ? null : values.summary.trim(),
          capital: values.capital.trim() === '' ? null : values.capital.trim(),
          population,
          areaKm2,
          wikipediaUrl: values.wikipediaUrl.trim() === '' ? null : values.wikipediaUrl.trim(),
          coatOfArmsUrl: values.coatOfArmsUrl.trim() === '' ? null : values.coatOfArmsUrl.trim(),
          continent: values.continent,
        },
      });
      setBanner({
        title: 'Saved',
        description: 'The country record has been updated.',
        tone: 'success',
      });
    } catch (error) {
      setBanner({ ...describeError(error), tone: 'danger' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {banner ? (
        <div
          role="alert"
          className={cn(
            'mb-5 flex items-start gap-3 rounded-xl border p-3 text-sm',
            banner.tone === 'danger'
              ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : 'border-success/30 bg-success/10 text-success',
          )}
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">{banner.title}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">{banner.description}</p>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="country-summary">Summary</Label>
          <div className="mt-1.5">
            <Textarea
              id="country-summary"
              value={values.summary}
              onChange={(event) => update('summary', event.target.value)}
              rows={4}
              placeholder="A short editorial summary shown on the country profile…"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="country-capital">Capital</Label>
            <div className="mt-1.5">
              <Input
                id="country-capital"
                value={values.capital}
                onChange={(event) => update('capital', event.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="country-continent">Continent</Label>
            <div className="mt-1.5">
              <select
                id="country-continent"
                value={values.continent}
                onChange={(event) => update('continent', event.target.value as Continent)}
                className="bg-surface-muted/60 border-border h-10 w-full rounded-lg border px-3 text-sm outline-none"
              >
                {CONTINENTS.map((continent) => (
                  <option key={continent} value={continent}>
                    {continent}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="country-population">Population</Label>
            <div className="mt-1.5">
              <Input
                id="country-population"
                type="number"
                min={0}
                value={values.population}
                onChange={(event) => update('population', event.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="country-area">Area (km²)</Label>
            <div className="mt-1.5">
              <Input
                id="country-area"
                type="number"
                min={0}
                value={values.areaKm2}
                onChange={(event) => update('areaKm2', event.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="country-wikipedia">Wikipedia URL</Label>
            <div className="mt-1.5">
              <Input
                id="country-wikipedia"
                type="url"
                value={values.wikipediaUrl}
                onChange={(event) => update('wikipediaUrl', event.target.value)}
                placeholder="https://en.wikipedia.org/wiki/…"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="country-coat-of-arms">Coat of arms URL</Label>
            <div className="mt-1.5">
              <Input
                id="country-coat-of-arms"
                type="url"
                value={values.coatOfArmsUrl}
                onChange={(event) => update('coatOfArmsUrl', event.target.value)}
                placeholder="https://…"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" loading={submitting}>
            Save changes
          </Button>
        </div>
      </form>
    </>
  );
}
