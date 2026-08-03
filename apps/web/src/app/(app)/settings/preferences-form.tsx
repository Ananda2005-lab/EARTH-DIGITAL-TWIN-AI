'use client';

import type { UserPreferences } from '@edt/shared';
import { useTheme } from 'next-themes';
import * as React from 'react';
import { toast } from 'sonner';

import { RequireAuthNotice } from '@/components/data/require-auth-notice';
import { Section } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { api, describeError } from '@/lib/api/client';

const THEME_OPTIONS = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
] as const;

const UNITS_OPTIONS = [
  { value: 'metric', label: 'Metric' },
  { value: 'imperial', label: 'Imperial' },
] as const;

const TEMPERATURE_OPTIONS = [
  { value: 'celsius', label: 'Celsius' },
  { value: 'fahrenheit', label: 'Fahrenheit' },
] as const;

const DENSITY_OPTIONS = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'detailed', label: 'Detailed' },
] as const;

const DIGEST_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
] as const;

/**
 * Preferences editor.
 *
 * The theme select is wired straight to `next-themes` for instant feedback in
 * addition to being part of the saved payload, so switching it changes the UI
 * before the network round trip even starts. Every other field is local state
 * until "Save changes" is pressed.
 *
 * When there is no session the form still renders — pre-filled with the
 * platform defaults passed down from the server — but every control is
 * disabled and a notice explains that signing in is required to persist
 * changes. This is the one settings-style page where a disabled preview reads
 * better than replacing the whole page with the sign-in empty state.
 */
export function PreferencesForm({
  initialPreferences,
  signedIn,
}: {
  initialPreferences: UserPreferences;
  signedIn: boolean;
}) {
  const { setTheme } = useTheme();
  const [preferences, setPreferences] = React.useState(initialPreferences);
  const [saving, setSaving] = React.useState(false);

  function update<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    setPreferences((prev) => ({ ...prev, [key]: value }));
    if (key === 'theme') setTheme(value as string);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api<UserPreferences>('/preferences', { method: 'PATCH', body: preferences });
      toast.success('Preferences saved');
    } catch (error) {
      const { title, description } = describeError(error);
      toast.error(title, { description });
    } finally {
      setSaving(false);
    }
  }

  return (
    <fieldset disabled={!signedIn} className="space-y-8 disabled:opacity-90">
      {!signedIn ? (
        <RequireAuthNotice
          title="Sign in to save changes"
          description="You can preview appearance settings below, but signing in is required to persist any changes."
        />
      ) : null}

      <Section title="Appearance" description="Theme, layer density and motion.">
        <Card>
          <CardContent className="grid gap-5 pt-5 sm:grid-cols-2">
            <Field label="Theme" htmlFor="pref-theme">
              <select
                id="pref-theme"
                value={preferences.theme}
                onChange={(event) =>
                  update('theme', event.target.value as UserPreferences['theme'])
                }
                disabled={!signedIn}
                className="bg-surface-muted/60 border-border h-10 w-full rounded-lg border px-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {THEME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Label density" htmlFor="pref-density">
              <select
                id="pref-density"
                value={preferences.labelDensity}
                onChange={(event) =>
                  update('labelDensity', event.target.value as UserPreferences['labelDensity'])
                }
                disabled={!signedIn}
                className="bg-surface-muted/60 border-border h-10 w-full rounded-lg border px-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {DENSITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <ToggleField
              label="Reduced motion"
              description="Minimise animation across the app."
              checked={preferences.reducedMotion}
              onCheckedChange={(checked) => update('reducedMotion', checked)}
              disabled={!signedIn}
            />
            <ToggleField
              label="High contrast"
              description="Stronger borders and text contrast."
              checked={preferences.highContrast}
              onCheckedChange={(checked) => update('highContrast', checked)}
              disabled={!signedIn}
            />
            <ToggleField
              label="Auto-rotate globe"
              description="Slowly spin the globe when idle."
              checked={preferences.autoRotateGlobe}
              onCheckedChange={(checked) => update('autoRotateGlobe', checked)}
              disabled={!signedIn}
            />
          </CardContent>
        </Card>
      </Section>

      <Section title="Units" description="Measurement system used across the app.">
        <Card>
          <CardContent className="grid gap-5 pt-5 sm:grid-cols-2">
            <Field label="Units" htmlFor="pref-units">
              <select
                id="pref-units"
                value={preferences.units}
                onChange={(event) =>
                  update('units', event.target.value as UserPreferences['units'])
                }
                disabled={!signedIn}
                className="bg-surface-muted/60 border-border h-10 w-full rounded-lg border px-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {UNITS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Temperature unit" htmlFor="pref-temperature">
              <select
                id="pref-temperature"
                value={preferences.temperatureUnit}
                onChange={(event) =>
                  update(
                    'temperatureUnit',
                    event.target.value as UserPreferences['temperatureUnit'],
                  )
                }
                disabled={!signedIn}
                className="bg-surface-muted/60 border-border h-10 w-full rounded-lg border px-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {TEMPERATURE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </CardContent>
        </Card>
      </Section>

      <Section title="Privacy" description="Telemetry and hazard alerting.">
        <Card>
          <CardContent className="grid gap-5 pt-5 sm:grid-cols-2">
            <ToggleField
              label="Share usage telemetry"
              description="Helps us improve the product. No location history is shared."
              checked={preferences.telemetryOptIn}
              onCheckedChange={(checked) => update('telemetryOptIn', checked)}
              disabled={!signedIn}
            />

            <Field label="Hazard alert radius (km)" htmlFor="pref-radius">
              <Input
                id="pref-radius"
                type="number"
                min={10}
                max={5000}
                value={preferences.hazardAlertRadiusKm}
                onChange={(event) =>
                  update('hazardAlertRadiusKm', Number.parseInt(event.target.value, 10) || 0)
                }
                disabled={!signedIn}
              />
            </Field>
          </CardContent>
        </Card>
      </Section>

      <Section title="Notifications" description="How often you receive an email digest.">
        <Card>
          <CardContent className="grid gap-5 pt-5 sm:grid-cols-2">
            <Field label="Email digest" htmlFor="pref-digest">
              <select
                id="pref-digest"
                value={preferences.emailDigest}
                onChange={(event) =>
                  update('emailDigest', event.target.value as UserPreferences['emailDigest'])
                }
                disabled={!signedIn}
                className="bg-surface-muted/60 border-border h-10 w-full rounded-lg border px-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {DIGEST_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </CardContent>
        </Card>
      </Section>

      <div className="flex justify-end">
        <Button onClick={handleSave} loading={saving} disabled={!signedIn || saving}>
          Save changes
        </Button>
      </div>
    </fieldset>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = React.useId();
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}
