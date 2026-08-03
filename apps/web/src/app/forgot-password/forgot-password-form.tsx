'use client';

import { forgotPasswordSchema } from '@edt/shared';
import { CheckCircle2, Mail, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import type { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { api, describeError } from '@/lib/api/client';

/** Flattens Zod issues into a `path -> message` map, keeping the first message per field. */
function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root';
    if (out[key] === undefined) out[key] = issue.message;
  }
  return out;
}

export function ForgotPasswordForm() {
  const [email, setEmail] = React.useState('');
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [banner, setBanner] = React.useState<{ title: string; description: string } | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFieldErrors({});
    setBanner(null);

    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }

    setSubmitting(true);
    try {
      // The endpoint always answers 2xx regardless of whether the address is
      // registered, so this can't be used to enumerate accounts — the UI just
      // shows the same confirmation either way.
      await api('/auth/forgot-password', { method: 'POST', body: parsed.data });
      setSent(true);
    } catch (error) {
      setBanner(describeError(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <span className="bg-success/12 text-success mx-auto inline-flex size-12 items-center justify-center rounded-2xl">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <p className="mt-4 text-sm font-medium">Check your inbox</p>
        <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
          If an account exists for <span className="text-foreground font-medium">{email}</span>, a
          reset link is on its way.
        </p>
        <Link
          href="/login"
          className="text-primary mt-6 inline-block text-sm font-medium hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
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

        <Button type="submit" className="w-full" loading={submitting}>
          Send reset link
        </Button>
      </form>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Remembered your password?{' '}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
