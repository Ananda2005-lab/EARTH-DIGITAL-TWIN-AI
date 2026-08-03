import type { NotificationItem, PaginatedResult } from '@edt/shared';
import type { Metadata } from 'next';

import { RequireAuthNotice } from '@/components/data/require-auth-notice';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api/client';

import { NotificationsList } from './notifications-list';

export const metadata: Metadata = {
  title: 'Notifications',
  description: 'Hazard alerts, report completions, billing and security notices.',
};

// Reads the signed-in user's notifications, which is per-request data.
export const dynamic = 'force-dynamic';

interface NotificationsData {
  notifications: PaginatedResult<NotificationItem>;
  unread: number;
}

async function loadNotifications(): Promise<NotificationsData | null> {
  try {
    const [notifications, unreadCount] = await Promise.all([
      api<PaginatedResult<NotificationItem>>('/notifications', { query: { pageSize: 100 } }),
      api<{ unread: number }>('/notifications/unread-count'),
    ]);
    return { notifications, unread: unreadCount.unread };
  } catch {
    return null;
  }
}

export default async function NotificationsPage() {
  const data = await loadNotifications();

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          data && data.unread > 0 ? (
            <Badge variant="primary">{data.unread} unread</Badge>
          ) : data ? (
            <Badge variant="neutral">All caught up</Badge>
          ) : undefined
        }
        title="Notifications"
        description="Hazard alerts near places you track, report completions, and account activity."
      />

      {!data ? (
        <RequireAuthNotice description="Sign in to see your notifications." />
      ) : (
        <NotificationsList initialItems={data.notifications.items} />
      )}
    </PageContainer>
  );
}
