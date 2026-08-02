'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as React from 'react';

import { cn } from '@/lib/utils';

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(function TooltipContent({ className, sideOffset = 8, ...props }, ref) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'glass text-foreground z-modal shadow-glass-sm max-w-xs rounded-lg px-2.5 py-1.5 text-xs',
          'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
});

/** Shorthand for the common label-only case. */
export function Hint({
  label,
  children,
  side = 'right',
  shortcut,
}: {
  label: string;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  shortcut?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className="flex items-center gap-2">
        <span>{label}</span>
        {shortcut ? (
          <kbd className="bg-surface-muted text-muted-foreground rounded px-1 py-0.5 font-mono text-[10px] uppercase">
            {shortcut}
          </kbd>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
