'use client';

import { ADMIN_NAV_ITEMS, NAV_GROUP_LABEL, NAV_ITEMS, type NavItem } from '@edt/shared';
import { Command as CommandPrimitive } from 'cmdk';
import { Monitor, Moon, Search, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { NavIcon } from '@/components/nav-icon';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface CommandPaletteContext {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

const Context = React.createContext<CommandPaletteContext | null>(null);

/** Access the palette from anywhere (topbar button, empty states, shortcuts). */
export function useCommandPalette(): CommandPaletteContext {
  const context = React.useContext(Context);
  if (!context) throw new Error('useCommandPalette must be used inside <CommandPaletteProvider>');
  return context;
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const value = React.useMemo<CommandPaletteContext>(
    () => ({ open, setOpen, toggle: () => setOpen((previous) => !previous) }),
    [open],
  );

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((previous) => !previous);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <Context.Provider value={value}>
      {children}
      <CommandPalette open={open} onOpenChange={setOpen} />
    </Context.Provider>
  );
}

function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { setTheme } = useTheme();

  const run = React.useCallback(
    (action: () => void) => {
      onOpenChange(false);
      action();
    },
    [onOpenChange],
  );

  const groups = React.useMemo(() => {
    const byGroup = new Map<string, NavItem[]>();
    for (const item of [...NAV_ITEMS, ...ADMIN_NAV_ITEMS]) {
      const label = NAV_GROUP_LABEL[item.group];
      const bucket = byGroup.get(label) ?? [];
      // Admin overview and the top-level admin entry share a destination.
      if (!bucket.some((existing) => existing.href === item.href)) bucket.push(item);
      byGroup.set(label, bucket);
    }
    return [...byGroup.entries()];
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        hideClose
        className="top-[18%] translate-y-0 p-0"
        aria-label="Command palette"
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <CommandPrimitive
          loop
          className="[&_[cmdk-group-heading]]:stat-label [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2"
        >
          <div className="border-border/60 flex items-center gap-2.5 border-b px-4">
            <Search className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <CommandPrimitive.Input
              placeholder="Search pages, places and commands…"
              className="placeholder:text-muted-foreground/70 h-12 w-full bg-transparent text-sm outline-none"
            />
            <kbd className="bg-surface-muted text-muted-foreground hidden rounded px-1.5 py-0.5 font-mono text-[10px] sm:block">
              ESC
            </kbd>
          </div>

          <CommandPrimitive.List className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
            <CommandPrimitive.Empty className="text-muted-foreground py-10 text-center text-sm">
              No matches.
            </CommandPrimitive.Empty>

            {groups.map(([label, items]) => (
              <CommandPrimitive.Group key={label} heading={label}>
                {items.map((item) => (
                  <CommandPrimitive.Item
                    key={`${label}:${item.id}`}
                    value={`${item.label} ${item.description}`}
                    onSelect={() => run(() => router.push(item.href))}
                    className={itemClasses}
                  >
                    <NavIcon name={item.icon} className="text-muted-foreground size-4 shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.shortcut ? (
                      <kbd className="text-muted-foreground font-mono text-[10px] uppercase tracking-widest">
                        {item.shortcut}
                      </kbd>
                    ) : null}
                  </CommandPrimitive.Item>
                ))}
              </CommandPrimitive.Group>
            ))}

            <CommandPrimitive.Group heading="Appearance">
              <CommandPrimitive.Item
                value="Dark theme"
                onSelect={() => run(() => setTheme('dark'))}
                className={itemClasses}
              >
                <Moon className="text-muted-foreground size-4" />
                Dark theme
              </CommandPrimitive.Item>
              <CommandPrimitive.Item
                value="Light theme"
                onSelect={() => run(() => setTheme('light'))}
                className={itemClasses}
              >
                <Sun className="text-muted-foreground size-4" />
                Light theme
              </CommandPrimitive.Item>
              <CommandPrimitive.Item
                value="System theme"
                onSelect={() => run(() => setTheme('system'))}
                className={itemClasses}
              >
                <Monitor className="text-muted-foreground size-4" />
                Match system
              </CommandPrimitive.Item>
            </CommandPrimitive.Group>
          </CommandPrimitive.List>
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  );
}

const itemClasses = cn(
  'flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none',
  'data-[selected=true]:bg-surface-muted data-[selected=true]:text-foreground text-muted-foreground',
);
