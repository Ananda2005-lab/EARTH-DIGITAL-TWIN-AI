'use client';

import { formatRelativeTime, type NotificationItem } from '@edt/shared';
import {
  CreditCard,
  FileText,
  Info,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api, describeError } from '@/lib/api/client';
import { cn } from '@/lib/utils';

const KIND_ICON: Record<NotificationItem['kind'], LucideIcon> = {
  hazard: TriangleAlert,
  report: FileText,
  system: Info,
  ai: Sparkles,
  billing: CreditCard,
  security: ShieldAlert,
};

const SEVERITY_BORDER: Record<NotificationItem['severity'], string> = {
  info: 'border-l-muted-foreground/40',
  success: 'border-l-success',
  warning: 'border-l-warning',
  critical: 'border-l-destructive',
};

const SEVERITY_ICON_TONE: Record<NotificationItem['severity'], string> = {
  info: 'text-muted-foreground bg-surface-muted',
  success: 'text-success bg-success/12',
  warning: 'text-warning bg-warning/12',
  critical: 'text-destructive bg-destructive/12',
};

export function NotificationsList({ initialItems }: { initialItems: NotificationItem[] }) {
  const [items, setItems] = React.useState(initialItems);
  const [markingAll, setMarkingAll] = React.useState(false);

  const unread = items.filter((item) => !item.read);
  const read = items.filter((item) => item.read);

  async function markAllRead() {
    setMarkingAll(true);
    try {
      await api('/notifications/read-all', { method: 'POST' });
      setItems((prev) => prev.map((item) => ({ ...item, read: true })));
      toast.success('All notifications marked as read');
    } catch (error) {
      const { title, description } = describeError(error);
      toast.error(title, { description });
    } finally {
      setMarkingAll(false);
    }
  }

  async function markRead(id: string) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
    try {
      await api(`/notifications/${id}/read`, { method: 'POST' });
    } catch (error) {
      const { title, description } = describeError(error);
      toast.error(title, { description });
    }
  }

  async function dismiss(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
    try {
      await api(`/notifications/${id}`, { method: 'DELETE' });
    } catch (error) {
      const { title, description } = describeError(error);
      toast.error(title, { description });
    }
  }

  if (items.length === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="display-tight text-base">No notifications</p>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
          Hazard alerts, report completions and account activity will appear here.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {unread.length > 0 ? (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" loading={markingAll} onClick={markAllRead}>
            Mark all read
          </Button>
        </div>
      ) : null}

      {unread.length > 0 ? (
        <section>
          <h3 className="stat-label mb-2">Unread</h3>
          <Card>
            <CardContent className="p-0">
              <ul className="divide-border/60 divide-y">
                {unread.map((item) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    onMarkRead={markRead}
                    onDismiss={dismiss}
                  />
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {read.length > 0 ? (
        <section>
          <h3 className="stat-label mb-2">Read</h3>
          <Card>
            <CardContent className="p-0">
              <ul className="divide-border/60 divide-y">
                {read.map((item) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    onMarkRead={markRead}
                    onDismiss={dismiss}
                  />
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

function NotificationRow({
  item,
  onMarkRead,
  onDismiss,
}: {
  item: NotificationItem;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const Icon = KIND_ICON[item.kind];

  const content = (
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <span
        className={cn(
          'mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg',
          SEVERITY_ICON_TONE[item.severity],
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm', item.read ? 'font-normal' : 'font-medium')}>
          {item.title}
        </p>
        <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-relaxed">
          {item.body}
        </p>
        <p className="text-muted-foreground/70 mt-1 text-xs">
          {formatRelativeTime(item.createdAt)}
        </p>
      </div>
    </div>
  );

  return (
    <li
      className={cn('flex items-start gap-2 border-l-2 px-5 py-3', SEVERITY_BORDER[item.severity])}
    >
      {item.actionUrl ? (
        <Link
          href={item.actionUrl}
          onClick={() => !item.read && onMarkRead(item.id)}
          className="focus-visible:ring-ring min-w-0 flex-1 rounded-lg outline-none focus-visible:ring-2"
        >
          {content}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => !item.read && onMarkRead(item.id)}
          className="focus-visible:ring-ring min-w-0 flex-1 rounded-lg text-left outline-none focus-visible:ring-2"
        >
          {content}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label={`Dismiss ${item.title}`}
        className="text-muted-foreground hover:text-foreground hover:bg-surface-muted mt-0.5 shrink-0 rounded-lg p-1.5 transition-colors"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </li>
  );
}
