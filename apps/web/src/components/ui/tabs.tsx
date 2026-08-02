'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as React from 'react';

import { cn } from '@/lib/utils';

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        'bg-surface-muted/70 border-border inline-flex items-center gap-1 rounded-xl border p-1',
        className,
      )}
      {...props}
    />
  );
});

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'ease-premium inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200',
        'text-muted-foreground hover:text-foreground',
        'data-[state=active]:bg-surface-strong data-[state=active]:text-foreground data-[state=active]:shadow-glass-sm',
        'focus-visible:ring-ring outline-none focus-visible:ring-2',
        'disabled:pointer-events-none disabled:opacity-50',
        '[&_svg]:size-4',
        className,
      )}
      {...props}
    />
  );
});

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn('focus-visible:ring-ring mt-4 outline-none focus-visible:ring-2', className)}
      {...props}
    />
  );
});
