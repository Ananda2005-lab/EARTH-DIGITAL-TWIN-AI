'use client';

import { usePathname } from 'next/navigation';
import * as React from 'react';

import { CommandPaletteProvider } from '@/components/command-palette';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

const COLLAPSE_STORAGE_KEY = 'edt:sidebar-collapsed';

/**
 * Application chrome for every authenticated-style route.
 *
 * The rail collapse choice is read from storage after mount rather than during
 * render, because the server has no way to know it and a mismatch would trip
 * hydration. The mobile drawer is a modal dialog so focus stays trapped while
 * it is open.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true');
  }, []);

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((previous) => {
      const next = !previous;
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  // Navigating from the drawer should dismiss it.
  React.useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // `[` mirrors the sidebar toggle, matching the hint shown in its tooltip.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '[' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable) return;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      event.preventDefault();
      toggleCollapsed();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleCollapsed]);

  return (
    <CommandPaletteProvider>
      <div className="bg-background relative flex h-dvh overflow-hidden">
        {/* Ambient backdrop so glass panels have something to refract. */}
        <div className="aurora-bg pointer-events-none fixed inset-0 opacity-[0.55]" aria-hidden />

        <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} className="hidden lg:flex" />

        <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <DialogContent
            hideClose
            className="data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left data-[state=open]:zoom-in-100 left-0 top-0 h-dvh w-64 max-w-none translate-x-0 translate-y-0 rounded-none border-0 p-0"
          >
            <DialogTitle className="sr-only">Navigation</DialogTitle>
            <Sidebar
              collapsed={false}
              onToggle={() => setMobileNavOpen(false)}
              className="w-full border-r-0"
            />
          </DialogContent>
        </Dialog>

        <div className="relative flex min-w-0 flex-1 flex-col">
          <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
          <main id="main" className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}
