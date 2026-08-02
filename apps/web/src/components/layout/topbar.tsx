'use client';

import { NAV_ITEMS } from '@edt/shared';
import { Bell, Menu, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { useCommandPalette } from '@/components/command-palette';
import { ThemeToggle } from '@/components/theme-toggle';
import { Avatar, AvatarFallback, initialsOf } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Hint } from '@/components/ui/tooltip';
import { isActive } from '@/components/layout/sidebar';

/**
 * Sticky header. Holds the page title derived from the route, the command
 * palette entry point and account controls.
 */
export function Topbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const pathname = usePathname();
  const palette = useCommandPalette();

  const current = React.useMemo(
    () => NAV_ITEMS.find((item) => isActive(pathname, item.href)),
    [pathname],
  );

  return (
    <header className="glass-sm z-header sticky top-0 flex h-14 items-center gap-3 border-b px-3 sm:px-5">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="display-tight truncate text-sm sm:text-base">
            {current?.label ?? 'Earth Digital Twin'}
          </h1>
          {current?.badge === 'live' ? (
            <Badge variant="success" className="uppercase">
              <span className="live-dot" aria-hidden />
              Live
            </Badge>
          ) : null}
        </div>
        {current?.description ? (
          <p className="text-muted-foreground hidden truncate text-xs sm:block">
            {current.description}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={palette.toggle}
        className="glass-sm text-muted-foreground hover:text-foreground focus-visible:ring-ring hidden h-9 w-56 items-center gap-2 rounded-lg px-3 text-sm transition-colors outline-none focus-visible:ring-2 md:flex xl:w-72"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="bg-surface-muted rounded px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
      </button>

      <Hint label="Search" shortcut="⌘K" side="bottom">
        <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={palette.toggle}>
          <Search />
          <span className="sr-only">Search</span>
        </Button>
      </Hint>

      <Hint label="Notifications" side="bottom">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/notifications">
            <Bell />
            <span className="sr-only">Notifications</span>
          </Link>
        </Button>
      </Hint>

      <ThemeToggle />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="focus-visible:ring-ring rounded-full outline-none focus-visible:ring-2"
            aria-label="Account menu"
          >
            <Avatar className="size-8">
              <AvatarFallback>{initialsOf('Explorer')}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuLabel>Signed out</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/login">Sign in</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/register">Create account</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings">Settings</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
