import {
  Bell,
  Bookmark,
  Bot,
  Building2,
  ChartColumn,
  Clock,
  Clock4,
  CloudSun,
  Earth,
  FileText,
  Flag,
  Gauge,
  GitCompareArrows,
  History,
  KeyRound,
  Layers,
  LayoutDashboard,
  Leaf,
  Map,
  Megaphone,
  Plane,
  Satellite,
  ScrollText,
  ServerCog,
  Settings,
  ShieldCheck,
  Ship,
  Sparkles,
  ToggleRight,
  TreePalm,
  TriangleAlert,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';

/**
 * `NAV_ITEMS` in `@edt/shared` carries icon *names* so the constant stays free of
 * React imports. Resolving them through an explicit registry keeps the bundle
 * tree-shakable — a dynamic `lucide-react` lookup would pull in all 1,500 icons.
 */
const REGISTRY: Record<string, LucideIcon> = {
  Bell,
  Bookmark,
  Bot,
  Building2,
  ChartColumn,
  Clock,
  Clock4,
  CloudSun,
  Earth,
  FileText,
  Flag,
  Gauge,
  GitCompareArrows,
  History,
  KeyRound,
  Layers,
  LayoutDashboard,
  Leaf,
  Map,
  Megaphone,
  Plane,
  Satellite,
  ScrollText,
  ServerCog,
  Settings,
  ShieldCheck,
  Ship,
  Sparkles,
  ToggleRight,
  TreePalm,
  TriangleAlert,
  UserRound,
  Users,
};

/** Falls back to a neutral glyph so an unknown name never breaks a layout. */
export function iconFor(name: string): LucideIcon {
  return REGISTRY[name] ?? Layers;
}

export function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = iconFor(name);
  return <Icon className={className} aria-hidden />;
}
