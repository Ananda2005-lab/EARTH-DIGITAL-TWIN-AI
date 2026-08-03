import type { Metadata } from 'next';

import { Logo } from '@/components/brand/logo';
import { Card } from '@/components/ui/card';

import { RegisterForm } from './register-form';

export const metadata: Metadata = {
  title: 'Create your account',
  description: 'Create an Earth Digital Twin AI account to save views, bookmarks and reports.',
};

export default function RegisterPage() {
  return (
    <main className="relative grid min-h-dvh place-items-center px-4 py-10">
      <div className="aurora-bg pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <Card className="relative w-full max-w-md p-8">
        <div className="flex flex-col items-center text-center">
          <Logo />
          <h1 className="display-tight mt-5 text-xl">Create your account</h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Save views, bookmarks and reports across sessions.
          </p>
        </div>

        <div className="mt-6">
          <RegisterForm />
        </div>
      </Card>
    </main>
  );
}
