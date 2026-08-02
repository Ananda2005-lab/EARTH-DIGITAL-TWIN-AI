'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import * as React from 'react';
import { Toaster } from 'sonner';

import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api/client';

/**
 * Client-side providers, mounted once in the root layout.
 *
 * The QueryClient is created inside state so each browser session (and each SSR
 * pass) gets its own cache instead of sharing one module-level instance across
 * requests.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Live feeds set their own shorter staleTime; this is the calm default.
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Never retry a request the server has already rejected on its merits.
          if (error instanceof ApiError && error.status < 500 && !error.isUpstream) return false;
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: { retry: false },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(makeQueryClient);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      // The palette lives on `.light`; dark is the base `:root`, so the dark
      // class is a no-op and must not be written as a value.
      value={{ light: 'light', dark: 'dark', system: 'dark' }}
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={250} skipDelayDuration={400}>
          {children}
          <Toaster
            position="bottom-right"
            gap={10}
            toastOptions={{
              classNames: {
                toast: 'glass !border-border !text-foreground !rounded-xl',
                description: '!text-muted-foreground',
              },
            }}
          />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
