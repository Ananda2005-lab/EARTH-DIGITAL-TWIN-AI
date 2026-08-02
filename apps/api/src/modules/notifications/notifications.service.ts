import { Injectable } from '@nestjs/common';
import type { NotificationAudience, NotificationPreference, Prisma } from '@prisma/client';
import type { NotificationItem, PaginatedResult } from '@edt/shared';
import { AppException } from 'src/common/errors/app-exception';
import { Paginated } from 'src/common/pagination';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { MailService } from 'src/infra/mail/mail.service';

export interface NotificationListQuery {
  page: number;
  pageSize: number;
  unreadOnly: boolean;
  kind?: NotificationItem['kind'];
}

export interface CreateNotificationInput {
  userId: string;
  kind: NotificationItem['kind'];
  severity: NotificationItem['severity'];
  title: string;
  body: string;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
  /** Also send an email when the user's preferences allow it. */
  email?: boolean;
}

export interface BroadcastInput {
  kind: NotificationItem['kind'];
  severity: NotificationItem['severity'];
  title: string;
  body: string;
  actionUrl?: string | null;
  audience: NotificationAudience;
  scheduledFor?: string | null;
}

export interface NotificationPreferencesView {
  channelInApp: boolean;
  channelEmail: boolean;
  channelWebhook: boolean;
  webhookUrl: string | null;
  hazardMinSeverity: NotificationPreference['hazardMinSeverity'];
  digest: NotificationPreference['digest'];
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  mutedKinds: NotificationItem['kind'][];
}

/**
 * In-app notification inbox, per-user delivery preferences and admin broadcasts.
 * Delivery respects muted kinds and quiet hours before anything is written.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async list(
    userId: string,
    query: NotificationListQuery,
  ): Promise<PaginatedResult<NotificationItem>> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      kind: query.kind,
      readAt: query.unreadOnly ? null : undefined,
    };
    const { skip, take } = Paginated.skipTake(query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.notification.count({ where }),
    ]);

    return Paginated.of(
      rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        kind: row.kind,
        severity: row.severity,
        title: row.title,
        body: row.body,
        actionUrl: row.actionUrl,
        read: row.readAt !== null,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      query,
    );
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string): Promise<void> {
    const notification = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notification) throw AppException.notFound('Notification not found');
    if (notification.readAt) return;
    await this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return result.count;
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await this.prisma.notification.deleteMany({ where: { id, userId } });
    if (result.count === 0) throw AppException.notFound('Notification not found');
  }

  /** Deliver to one user, honouring their channel and quiet-hour preferences. */
  async create(input: CreateNotificationInput): Promise<NotificationItem | null> {
    const [user, preference] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: input.userId },
        select: { email: true, name: true, deletedAt: true },
      }),
      this.prisma.notificationPreference.findUnique({ where: { userId: input.userId } }),
    ]);
    if (!user || user.deletedAt) return null;
    if (preference?.mutedKinds.includes(input.kind)) return null;
    if (preference && !preference.channelInApp && !preference.channelEmail) return null;
    if (preference && isQuietHour(preference, new Date()) && input.severity !== 'critical')
      return null;

    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        severity: input.severity,
        title: input.title,
        body: input.body,
        actionUrl: input.actionUrl ?? null,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        sentAt: new Date(),
      },
    });

    if (input.email && (preference?.channelEmail ?? true)) {
      await this.mail.send({ to: user.email, subject: input.title, text: input.body });
    }

    return {
      id: notification.id,
      userId: notification.userId,
      kind: notification.kind,
      severity: notification.severity,
      title: notification.title,
      body: notification.body,
      actionUrl: notification.actionUrl,
      read: false,
      createdAt: notification.createdAt.toISOString(),
    };
  }

  /** Admin broadcast. Immediate sends fan out per recipient; scheduled ones wait. */
  async broadcast(input: BroadcastInput): Promise<{ recipients: number; scheduled: boolean }> {
    const scheduledFor = input.scheduledFor ? new Date(input.scheduledFor) : null;
    if (scheduledFor && scheduledFor.getTime() > Date.now()) {
      await this.prisma.notification.create({
        data: {
          kind: input.kind,
          severity: input.severity,
          title: input.title,
          body: input.body,
          actionUrl: input.actionUrl ?? null,
          audience: input.audience,
          scheduledFor,
        },
      });
      return { recipients: 0, scheduled: true };
    }

    const recipients = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        status: { not: 'suspended' },
        ...(input.audience === 'admins'
          ? { role: { in: ['admin', 'owner'] } }
          : input.audience === 'all'
            ? {}
            : { plan: input.audience }),
      },
      select: { id: true },
    });

    await this.prisma.notification.createMany({
      data: recipients.map((recipient) => ({
        userId: recipient.id,
        kind: input.kind,
        severity: input.severity,
        title: input.title,
        body: input.body,
        actionUrl: input.actionUrl ?? null,
        audience: input.audience,
        sentAt: new Date(),
      })),
    });

    return { recipients: recipients.length, scheduled: false };
  }

  /** Dispatch broadcasts whose scheduled time has arrived. */
  async dispatchScheduled(): Promise<number> {
    const due = await this.prisma.notification.findMany({
      where: { userId: null, sentAt: null, scheduledFor: { lte: new Date() } },
    });
    let delivered = 0;
    for (const notification of due) {
      const result = await this.broadcast({
        kind: notification.kind,
        severity: notification.severity,
        title: notification.title,
        body: notification.body,
        actionUrl: notification.actionUrl,
        audience: notification.audience ?? 'all',
      });
      delivered += result.recipients;
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { sentAt: new Date() },
      });
    }
    return delivered;
  }

  async preferences(userId: string): Promise<NotificationPreferencesView> {
    const preference =
      (await this.prisma.notificationPreference.findUnique({ where: { userId } })) ??
      (await this.prisma.notificationPreference.create({ data: { userId } }));
    return toPreferencesView(preference);
  }

  async updatePreferences(
    userId: string,
    input: Partial<Omit<NotificationPreferencesView, 'mutedKinds'>> & {
      mutedKinds?: NotificationItem['kind'][];
    },
  ): Promise<NotificationPreferencesView> {
    if (input.channelWebhook && !input.webhookUrl) {
      const existing = await this.prisma.notificationPreference.findUnique({ where: { userId } });
      if (!existing?.webhookUrl)
        throw AppException.validation('A webhook URL is required to enable webhook delivery');
    }
    const preference = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...input },
      update: { ...input },
    });
    return toPreferencesView(preference);
  }
}

function toPreferencesView(preference: NotificationPreference): NotificationPreferencesView {
  return {
    channelInApp: preference.channelInApp,
    channelEmail: preference.channelEmail,
    channelWebhook: preference.channelWebhook,
    webhookUrl: preference.webhookUrl,
    hazardMinSeverity: preference.hazardMinSeverity,
    digest: preference.digest,
    quietHoursStart: preference.quietHoursStart,
    quietHoursEnd: preference.quietHoursEnd,
    mutedKinds: preference.mutedKinds,
  };
}

/** Quiet hours may wrap midnight (e.g. 22 → 7). */
export function isQuietHour(
  preference: Pick<NotificationPreference, 'quietHoursStart' | 'quietHoursEnd'>,
  at: Date,
): boolean {
  const { quietHoursStart: start, quietHoursEnd: end } = preference;
  if (start === null || end === null) return false;
  const hour = at.getUTCHours();
  return start <= end ? hour >= start && hour < end : hour >= start || hour < end;
}
