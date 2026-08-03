import type { Metadata } from 'next';

import { Logo } from '@/components/brand/logo';
import { Card } from '@/components/ui/card';

import { ForgotPasswordForm } from './forgot-password-form';

export const metadata: Metadata = {
  title: 'Reset your password',
  description: 'Request a password reset link for your Earth Digital Twin AI account.',
};

export default function ForgotPasswordPage() {
  return (
    <main className="relative grid min-h-dvh place-items-center px-4">
      <div className="aurora-bg pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <Card className="relative w-full max-w-md p-8">
        <div className="flex flex-col items-center text-center">
          <Logo />
          <h1 className="display-tight mt-5 text-xl">Reset your password</h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        <div className="mt-6">
          <ForgotPasswordForm />
        </div>
      </Card>
    </main>
  );
}
