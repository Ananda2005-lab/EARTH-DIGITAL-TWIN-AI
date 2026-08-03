import type { Metadata } from 'next';

import { Logo } from '@/components/brand/logo';
import { Card } from '@/components/ui/card';

import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Earth Digital Twin AI to access Mission Control and your saved views.',
};

export default function LoginPage() {
  return (
    <main className="relative grid min-h-dvh place-items-center px-4">
      <div className="aurora-bg pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <Card className="relative w-full max-w-md p-8">
        <div className="flex flex-col items-center text-center">
          <Logo />
          <h1 className="display-tight mt-5 text-xl">Welcome back</h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Sign in to continue to Mission Control.
          </p>
        </div>

        <div className="mt-6">
          <LoginForm />
        </div>
      </Card>
    </main>
  );
}
