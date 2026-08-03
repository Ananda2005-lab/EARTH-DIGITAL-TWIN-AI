'use client';

import { passwordStrength, registerSchema, type AuthSession } from '@edt/shared';
import { Building2, Eye, EyeOff, Lock, Mail, TriangleAlert, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import type { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { api, describeError } from '@/lib/api/client';
import { cn } from '@/lib/utils';

/** Flattens Zod issues into a `path -> message` map, keeping the first message per field. */
function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root';
    if (out[key] === undefined) out[key] = issue.message;
  }
  return out;
}

const STRENGTH_COLORS = [
  'bg-destructive',
  'bg-destructive',
  'bg-warning',
  'bg-success',
  'bg-success',
];

function StrengthMeter({ password }: { password: string }) {
  if (password.length === 0) return null;
  const { score, label } = passwordStrength(password);
  return (
    <div className="mt-2">
      <div className="grid grid-cols-5 gap-1">
        {Array.from({ length: 5 }, (_, index) => (
          <span
            key={index}
            className={cn(
              'h-1.5 rounded-full transition-colors',
              index <= score ? STRENGTH_COLORS[score] : 'bg-surface-muted',
            )}
          />
        ))}
      </div>
      <p className="text-muted-foreground mt-1 text-xs">{label}</p>
    </div>
  );
}

export function RegisterForm() {
  const router = useRouter();

  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [organisation, setOrganisation] = React.useState('');
  const [acceptTerms, setAcceptTerms] = React.useState(false);
  const [marketingOptIn, setMarketingOptIn] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [banner, setBanner] = React.useState<{ title: string; description: string } | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFieldErrors({});
    setBanner(null);

    const parsed = registerSchema.safeParse({
      name,
      email,
      password,
      organisation: organisation.trim() === '' ? undefined : organisation.trim(),
      acceptTerms,
      marketingOptIn,
    });

    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }

    setSubmitting(true);
    try {
      // `POST /auth/register` (see auth.controller.ts) issues a signed-in
      // session immediately alongside the verification email — it does not
      // gate access on verifying the address — so a successful call goes
      // straight to the dashboard rather than to a "check your email" step.
      await api<AuthSession>('/auth/register', { method: 'POST', body: parsed.data });
      router.push('/dashboard');
    } catch (error) {
      setBanner(describeError(error));
    } finally {
      setSubmitting(false);
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

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="name">Name</Label>
          <div className="mt-1.5">
            <Input
              id="name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              invalid={Boolean(fieldErrors.name)}
              leading={<User />}
              placeholder="Ada Lovelace"
            />
          </div>
          {fieldErrors.name ? (
            <p className="text-destructive mt-1.5 text-xs">{fieldErrors.name}</p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <div className="mt-1.5">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              invalid={Boolean(fieldErrors.email)}
              leading={<Mail />}
              placeholder="you@example.com"
            />
          </div>
          {fieldErrors.email ? (
            <p className="text-destructive mt-1.5 text-xs">{fieldErrors.email}</p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <div className="mt-1.5">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              invalid={Boolean(fieldErrors.password)}
              leading={<Lock />}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="hover:text-foreground"
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              }
            />
          </div>
          <StrengthMeter password={password} />
          {fieldErrors.password ? (
            <p className="text-destructive mt-1.5 text-xs">{fieldErrors.password}</p>
          ) : (
            <p className="text-muted-foreground mt-1.5 text-xs">
              At least 12 characters, with upper, lower, a number and a symbol.
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="organisation">Organisation (optional)</Label>
          <div className="mt-1.5">
            <Input
              id="organisation"
              autoComplete="organization"
              value={organisation}
              onChange={(event) => setOrganisation(event.target.value)}
              invalid={Boolean(fieldErrors.organisation)}
              leading={<Building2 />}
              placeholder="Acme Corp"
            />
          </div>
          {fieldErrors.organisation ? (
            <p className="text-destructive mt-1.5 text-xs">{fieldErrors.organisation}</p>
          ) : null}
        </div>

        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-2">
            <Switch id="acceptTerms" checked={acceptTerms} onCheckedChange={setAcceptTerms} />
            <Label htmlFor="acceptTerms" className="cursor-pointer text-sm font-normal">
              I accept the terms of service and privacy policy
            </Label>
          </div>
          {fieldErrors.acceptTerms ? (
            <p className="text-destructive text-xs">{fieldErrors.acceptTerms}</p>
          ) : null}

          <div className="flex items-center gap-2">
            <Switch
              id="marketingOptIn"
              checked={marketingOptIn}
              onCheckedChange={setMarketingOptIn}
            />
            <Label htmlFor="marketingOptIn" className="cursor-pointer text-sm font-normal">
              Send me product updates
            </Label>
          </div>
        </div>

        <Button type="submit" className="w-full" loading={submitting}>
          Create account
        </Button>
      </form>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Already have an account?{' '}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
