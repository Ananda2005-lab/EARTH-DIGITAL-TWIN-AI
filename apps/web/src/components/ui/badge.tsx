import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'text-2xs inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium tracking-wide transition-colors [&_svg]:size-3',
  {
    variants: {
      variant: {
        neutral: 'border-border bg-surface-muted text-muted-foreground',
        primary: 'border-primary/30 bg-primary/12 text-primary',
        secondary: 'border-secondary/30 bg-secondary/12 text-secondary',
        accent: 'border-accent/30 bg-accent/12 text-accent',
        success: 'border-success/30 bg-success/12 text-success',
        warning: 'border-warning/30 bg-warning/12 text-warning',
        danger: 'border-destructive/30 bg-destructive/12 text-destructive',
        outline: 'border-border text-foreground bg-transparent',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Pulsing dot plus label for feeds that update continuously. */
export function LiveBadge({ label = 'Live', className }: { label?: string; className?: string }) {
  return (
    <Badge variant="success" className={cn('uppercase', className)}>
      <span className="live-dot" aria-hidden />
      {label}
    </Badge>
  );
}

export { badgeVariants };
