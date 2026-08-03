import { LogIn } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Shared empty state for any server component that needs a signed-in user.
 *
 * There is no live session yet — every page that reads a user-scoped endpoint
 * wraps its fetch in a try/catch and renders this instead of the real content
 * when the call is unauthorised or the gateway cannot be reached at all, so the
 * route always renders successfully regardless of backend availability.
 */
export function RequireAuthNotice({
  title = 'Sign in required',
  description = 'Sign in to your account to see this content.',
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <Card className={cn('p-10 text-center', className)}>
      <span className="bg-primary/12 text-primary mx-auto inline-flex size-12 items-center justify-center rounded-2xl">
        <LogIn className="size-6" aria-hidden />
      </span>
      <h2 className="display-tight mt-5 text-lg">{title}</h2>
      <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
        {description}
      </p>
      <div className="mt-6 flex justify-center">
        <Button asChild>
          <Link href="/login">
            <LogIn />
            Sign in
          </Link>
        </Button>
      </div>
    </Card>
  );
}
