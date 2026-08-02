'use client';

import { NAV_GROUP_LABEL, NAV_ITEMS, type NavGroup, type NavItem } from '@edt/shared';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { Logo } from '@/components/brand/logo';
import { NavIcon } from '@/components/nav-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Hint } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const GROUP_ORDER: NavGroup[] = ['explore', 'monitor', 'analyse', 'work', 'account'];

const BADGE_VARIANT = {
  live: 'success',
  ai: 'secondary',
  beta: 'warning',
  new: 'primary',
} as const;

/**
 * Primary navigation. Collapsible to an icon rail so the globe keeps as much
 * viewport as possible; the choice persists per browser.
 */
export function Sidebar({
  collapsed,
  onToggle,
  className,
}: {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const pathname = usePathname();

  const groups = React.useMemo(() => {
    return GROUP_ORDER.map((group) => ({
      group,
      items: NAV_ITEMS.filter((item) => item.group === group),
    })).filter((entry) => entry.items.length > 0);
  }, []);

  return (
    <aside
      className={cn(
        'glass ease-premium z-panel flex h-full shrink-0 flex-col border-r transition-[width] duration-300',
        collapsed ? 'w-[68px]' : 'w-64',
        className,
      )}
      aria-label="Primary"
    >
      <div className={cn('flex h-14 items-center', collapsed ? 'justify-center' : 'px-4')}>
        <Link
          href="/dashboard"
          className="focus-visible:ring-ring rounded-lg outline-none focus-visible:ring-2"
        >
          <Logo showWordmark={!collapsed} />
        </Link>
      </div>

      <ScrollArea className="flex-1">
        <nav className={cn('flex flex-col gap-6 pb-4', collapsed ? 'items-center px-2' : 'px-3')}>
          {groups.map(({ group, items }) => (
            <div key={group} className="flex w-full flex-col gap-1">
              {collapsed ? (
                <span className="bg-border/70 mx-auto mb-1 h-px w-6" aria-hidden />
              ) : (
                <span className="stat-label px-2">{NAV_GROUP_LABEL[group]}</span>
              )}
              {items.map((item) => (
                <SidebarLink
                  key={item.id}
                  item={item}
                  collapsed={collapsed}
                  active={isActive(pathname, item.href)}
                />
              ))}
            </div>
          ))}
        </nav>
      </ScrollArea>

      <div className={cn('border-border/60 border-t p-2', collapsed && 'flex justify-center')}>
        <Hint label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} shortcut="[">
          <Button
            variant="ghost"
            size={collapsed ? 'icon-sm' : 'sm'}
            onClick={onToggle}
            aria-expanded={!collapsed}
            className={cn(!collapsed && 'w-full justify-start')}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            {collapsed ? null : <span>Collapse</span>}
          </Button>
        </Hint>
      </div>
    </aside>
  );
}

function SidebarLink({
  item,
  collapsed,
  active,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
}) {
  const link = (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'ease-premium group relative flex items-center rounded-lg text-sm font-medium transition-all duration-200',
        'focus-visible:ring-ring outline-none focus-visible:ring-2',
        collapsed ? 'size-10 justify-center' : 'gap-2.5 px-2.5 py-2',
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
      {collapsed ? null : (
        <>
          <span className="truncate">{item.label}</span>
          {item.badge ? (
            <Badge variant={BADGE_VARIANT[item.badge]} className="ml-auto uppercase">
              {item.badge}
            </Badge>
          ) : null}
        </>
      )}
    </Link>
  );

  if (!collapsed) return link;
  return (
    <Hint label={item.label} shortcut={item.shortcut}>
      {link}
    </Hint>
  );
}

/** `/countries` should stay active on `/countries/ke`, but `/` must not match all. */
export function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
