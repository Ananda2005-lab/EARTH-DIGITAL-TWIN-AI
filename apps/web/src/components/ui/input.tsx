import * as React from 'react';

import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Rendered inside the field on the leading edge, typically an icon. */
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, leading, trailing, invalid, ...props },
  ref,
) {
  const field = (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'bg-surface-muted/60 border-border h-10 w-full rounded-lg border px-3 text-sm',
        'placeholder:text-muted-foreground/70 transition-colors',
        'focus-visible:border-primary/60 focus-visible:ring-ring/40 outline-none focus-visible:ring-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalid && 'border-destructive/60 focus-visible:ring-destructive/30',
        leading != null && 'pl-9',
        trailing != null && 'pr-9',
        className,
      )}
      {...props}
    />
  );

  if (leading == null && trailing == null) return field;

  return (
    <div className="relative">
      {leading != null ? (
        <span
          className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 [&_svg]:size-4"
          aria-hidden
        >
          {leading}
        </span>
      ) : null}
      {field}
      {trailing != null ? (
        <span className="text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 [&_svg]:size-4">
          {trailing}
        </span>
      ) : null}
    </div>
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'bg-surface-muted/60 border-border min-h-20 w-full resize-y rounded-lg border px-3 py-2 text-sm',
        'placeholder:text-muted-foreground/70 transition-colors',
        'focus-visible:border-primary/60 focus-visible:ring-ring/40 outline-none focus-visible:ring-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalid && 'border-destructive/60 focus-visible:ring-destructive/30',
        className,
      )}
      {...props}
    />
  );
});

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(function Label({ className, ...props }, ref) {
  return (
    <label
      ref={ref}
      className={cn('text-foreground text-sm font-medium leading-none', className)}
      {...props}
    />
  );
});
