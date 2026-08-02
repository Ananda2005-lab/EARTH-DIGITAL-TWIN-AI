import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  cn(
    'ease-premium inline-flex select-none items-center justify-center gap-2 whitespace-nowrap',
    'rounded-lg text-sm font-medium transition-all duration-200',
    'focus-visible:ring-ring focus-visible:ring-offset-background outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
    'active:scale-[0.98] active:transition-none',
  ),
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground shadow-glow hover:shadow-glow-lg hover:brightness-110',
        secondary: 'bg-surface-muted text-foreground border-border border hover:bg-surface-strong',
        ghost: 'text-muted-foreground hover:text-foreground hover:bg-surface-muted',
        outline: 'border-border text-foreground hover:bg-surface-muted border bg-transparent',
        glass: 'glass-sm text-foreground hover:border-primary/30 hover:shadow-glow',
        destructive: 'bg-destructive text-destructive-foreground hover:brightness-110',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        xs: 'h-7 rounded-md px-2 text-xs [&_svg]:size-3.5',
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
        lg: 'h-11 rounded-xl px-6 text-base',
        icon: 'size-10',
        'icon-sm': 'size-8 rounded-md',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as the single child element instead of a `<button>`. */
  asChild?: boolean;
  /** Shows a spinner and blocks interaction without changing layout width. */
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, loading = false, children, disabled, ...props },
  ref,
) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
      {children}
    </Component>
  );
});

export { buttonVariants };
