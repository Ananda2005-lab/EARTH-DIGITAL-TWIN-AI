'use client';

import { ADMIN_NAV_ITEMS } from '@edt/shared';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { isActive } from '@/components/layout/sidebar';
import { NavIcon } from '@/components/nav-icon';
import { cn } from '@/lib/utils';

/**
 * Secondary rail for every `/admin/*` route. Mirrors the active-state styling
 * of the primary `Sidebar` (bg-primary/12 fill, left accent bar) but stays
 * fixed-width with no collapse toggle — this is a nested navigation, not the
 * main app shell.
 */
export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="glass-sm z-panel flex h-full w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r p-3"
      aria-label="Administration"
    >
      {ADMIN_NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'ease-premium group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-200',
              'focus-visible:ring-ring outline-none focus-visible:ring-2',
              active
                ? 'bg-primary/12 text-foreground'
                : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
            )}
          >
            {active ? (
              <span
                className="bg-primary absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full"
                aria-hidden
              />
            ) : null}
            <NavIcon
              name={item.icon}
              className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-current')}
            />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </aside>
  );
}
