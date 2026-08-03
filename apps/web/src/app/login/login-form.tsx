'use client';

import { loginSchema, type AuthSession } from '@edt/shared';
import { Eye, EyeOff, Lock, Mail, ShieldCheck, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import type { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { api, ApiError, describeError } from '@/lib/api/client';
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

interface Banner {
  title: string;
  description: string;
  tone: 'danger' | 'warning';
}

/**
 * MFA note: the API answers both "bad credentials" and "MFA code required" with
 * the same 401 / `UNAUTHORISED` envelope, differing only in message text (see
 * `auth.service.ts` login flow and `mfa.service.ts#verifyForLogin`). There is no
 * distinct error code to branch on, so this detects the MFA case by matching
 * that message and reveals the code field for a resubmit rather than
 * implementing a separate challenge/response contract.
 */
function isMfaRequiredError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401 && /multi-factor/i.test(error.message);
}

export function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [remember, setRemember] = React.useState(true);
  const [mfaCode, setMfaCode] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [showMfaField, setShowMfaField] = React.useState(false);
  const [mfaRequired, setMfaRequired] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [banner, setBanner] = React.useState<Banner | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFieldErrors({});
    setBanner(null);

    const parsed = loginSchema.safeParse({
      email,
      password,
      remember,
      mfaCode: mfaCode.trim() === '' ? undefined : mfaCode.trim(),
    });

    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }

    setSubmitting(true);
    try {
      await api<AuthSession>('/auth/login', { method: 'POST', body: parsed.data });
      router.push('/dashboard');
    } catch (error) {
      if (isMfaRequiredError(error)) {
        setMfaRequired(true);
        setBanner({
          title: 'Two-factor code required',
          description: 'Enter the 6-digit code from your authenticator app to finish signing in.',
          tone: 'warning',
        });
      } else {
        setBanner({ ...describeError(error), tone: 'danger' });
      }
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
              : 'border-warning/30 bg-warning/10 text-warning',
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
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-primary text-xs hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="mt-1.5">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
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
          {fieldErrors.password ? (
            <p className="text-destructive mt-1.5 text-xs">{fieldErrors.password}</p>
          ) : null}
        </div>

        {showMfaField || mfaRequired ? (
          <div>
            <Label htmlFor="mfaCode">Authentication code</Label>
            <div className="mt-1.5">
              <Input
                id="mfaCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                invalid={Boolean(fieldErrors.mfaCode)}
                leading={<ShieldCheck />}
              />
            </div>
            {fieldErrors.mfaCode ? (
              <p className="text-destructive mt-1.5 text-xs">{fieldErrors.mfaCode}</p>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowMfaField(true)}
            className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
          >
            Have a 2FA code?
          </button>
        )}

        <div className="flex items-center gap-2">
          <Switch id="remember" checked={remember} onCheckedChange={setRemember} />
          <Label htmlFor="remember" className="cursor-pointer text-sm font-normal">
            Remember me
          </Label>
        </div>

        <Button type="submit" className="w-full" loading={submitting}>
          Sign in
        </Button>
      </form>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-primary font-medium hover:underline">
          Create one
        </Link>
      </p>
    </>
  );
}
