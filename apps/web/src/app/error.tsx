'use client';

import { RotateCcw, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { describeError } from '@/lib/api/client';

/**
 * Root error boundary. Renders the same copy the toasts use so a failure reads
 * consistently wherever it surfaces, and never leaks a stack trace to the user.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Surfaced in the browser console and server logs for triage.
    console.error('Unhandled route error', error);
  }, [error]);

  const { title, description } = describeError(error);

  return (
    <main className="relative grid min-h-dvh place-items-center px-4">
      <div className="aurora-bg pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <Card className="relative w-full max-w-md p-8 text-center">
        <span className="bg-destructive/12 text-destructive mx-auto inline-flex size-12 items-center justify-center rounded-2xl">
          <TriangleAlert className="size-6" aria-hidden />
        </span>
        <h1 className="display-tight mt-5 text-xl">{title}</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{description}</p>
        {error.digest ? (
          <p className="text-muted-foreground/70 numeric mt-3 text-xs">Ref {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={reset}>
            <RotateCcw />
            Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Mission Control</Link>
          </Button>
        </div>
      </Card>
    </main>
  );
}
