import { PLATFORM } from '@edt/shared';

import { cn } from '@/lib/utils';

/** Wordmark plus glyph. The glyph alone is used in the collapsed sidebar. */
export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoGlyph />
      {showWordmark ? (
        <span className="display-tight text-[15px] leading-none">
          <span className="text-gradient-brand">Earth</span>
          <span className="text-foreground"> Twin</span>
        </span>
      ) : (
        <span className="sr-only">{PLATFORM.name}</span>
      )}
    </span>
  );
}

export function LogoGlyph({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'from-primary/25 via-secondary/25 to-accent/25 ring-primary/25 relative grid size-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br ring-1',
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none">
        <circle cx="12" cy="12" r="8" stroke="url(#logo-stroke)" strokeWidth="1.5" />
        <ellipse cx="12" cy="12" rx="3.4" ry="8" stroke="url(#logo-stroke)" strokeWidth="1.1" />
        <path d="M4 12h16" stroke="url(#logo-stroke)" strokeWidth="1.1" />
        <defs>
          <linearGradient id="logo-stroke" x1="0" y1="0" x2="24" y2="24">
            <stop stopColor="hsl(var(--primary))" />
            <stop offset="0.55" stopColor="hsl(var(--secondary))" />
            <stop offset="1" stopColor="hsl(var(--accent))" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}
