import type * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Consistent page framing. Every route inside the app shell opens with a
 * `PageHeader` followed by content inside a `PageContainer`, so vertical rhythm
 * and gutters stay identical across 20+ screens.
 */
export function PageContainer({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mx-auto w-full max-w-[1600px] px-4 pb-16 pt-5 sm:px-6 lg:px-8', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: string;
  description?: string;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="min-w-0 max-w-3xl">
        {eyebrow ? <div className="mb-2 flex items-center gap-2">{eyebrow}</div> : null}
        <h2 className="display-tight text-gradient text-2xl sm:text-3xl">{title}</h2>
        {description ? (
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed sm:text-[0.95rem]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Titled band inside a page, used to break long screens into scannable blocks. */
export function Section({
  title,
  description,
  actions,
  className,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn('mb-8', className)}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="display-tight text-base sm:text-lg">{title}</h3>
          {description ? (
            <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
