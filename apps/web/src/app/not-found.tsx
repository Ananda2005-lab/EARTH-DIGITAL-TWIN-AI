import { Compass, Home } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function NotFound() {
  return (
    <main className="relative grid min-h-dvh place-items-center px-4">
      <div className="aurora-bg pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <Card className="relative w-full max-w-md p-8 text-center">
        <span className="bg-primary/12 text-primary mx-auto inline-flex size-12 items-center justify-center rounded-2xl">
          <Compass className="size-6" aria-hidden />
        </span>
        <p className="stat-label mt-5">Error 404</p>
        <h1 className="display-tight text-gradient mt-2 text-2xl">Off the map</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          This coordinate does not exist. The planet, thankfully, still does.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/dashboard">
              <Home />
              Mission Control
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/globe">Open the globe</Link>
          </Button>
        </div>
      </Card>
    </main>
  );
}
