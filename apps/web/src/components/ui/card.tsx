import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Surface container. `glass` is the default because nearly every panel in the
 * product floats above the globe or a gradient backdrop.
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'glass' | 'solid' | 'outline';
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, variant = 'glass', interactive = false, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'relative rounded-2xl',
        variant === 'glass' && 'glass glass-highlight',
        variant === 'solid' && 'bg-surface border-border border shadow-glass-sm',
        variant === 'outline' && 'border-border border bg-transparent',
        interactive && 'hover-lift cursor-pointer',
        className,
      )}
      {...props}
    />
  );
});

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn('flex flex-col gap-1.5 px-5 pb-3 pt-5 sm:px-6 sm:pt-6', className)}
        {...props}
      />
    );
  },
);

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  function CardTitle({ className, ...props }, ref) {
    return (
      <h3
        ref={ref}
        className={cn('display-tight text-base leading-tight sm:text-lg', className)}
        {...props}
      />
    );
  },
);

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(function CardDescription({ className, ...props }, ref) {
  return <p ref={ref} className={cn('text-muted-foreground text-sm', className)} {...props} />;
});

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className, ...props }, ref) {
    return <div ref={ref} className={cn('px-5 pb-5 sm:px-6 sm:pb-6', className)} {...props} />;
  },
);

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn('border-border/60 flex items-center gap-3 border-t px-5 py-4 sm:px-6', className)}
        {...props}
      />
    );
  },
);
