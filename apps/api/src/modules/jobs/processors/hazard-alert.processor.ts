import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { HAZARD_SEVERITY_ORDER, haversineDistance, type HazardEvent } from '@edt/shared';
import type { AppConfig } from 'src/config/configuration';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { HazardsService } from 'src/modules/hazards/hazards.service';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import { QUEUE_NAMES, type HazardFanOutJob } from '../queues';

/**
 * Matches newly observed hazards against geofenced subscriptions and fans out
 * notifications.
 *
 * Candidate alerts come from a PostGIS `ST_DWithin` query (or a haversine
 * fallback), then kind/severity/mute filters are applied in code. Each alert is
 * updated with its trigger count so users can see why they were pinged.
 */
@Processor(QUEUE_NAMES.hazardAlerts, { concurrency: 1 })
export class HazardAlertProcessor extends WorkerHost {
  private readonly logger = new Logger(HazardAlertProcessor.name);

  constructor(
    private readonly hazards: HazardsService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {
    super();
  }

  async process(job: Job<HazardFanOutJob>): Promise<{ events: number; notifications: number }> {
    const events = job.data.events ?? (await this.hazards.syncCache(job.data.hours ?? 6));
    let sent = 0;

    for (const event of events) {
      sent += await this.fanOut(event);
    }

    if (events.length > 0) {
      this.logger.log(`Hazard fan-out: ${events.length} events → ${sent} notifications`);
    }
    return { events: events.length, notifications: sent };
  }

  private async fanOut(event: HazardEvent): Promise<number> {
    const candidateIds = await this.prisma.findAlertIdsWithinRadius(event.location.lng, event.location.lat);
    if (candidateIds.length === 0) return 0;

    const alerts = await this.prisma.alert.findMany({
      where: { id: { in: candidateIds }, active: true },
      include: { user: { select: { id: true, deletedAt: true, status: true } } },
    });

    const webAppUrl = this.config.get('webAppUrl', { infer: true });
    let sent = 0;

    for (const alert of alerts) {
      if (alert.user.deletedAt || alert.user.status === 'suspended') continue;
      if (alert.kinds.length > 0 && !alert.kinds.includes(event.kind)) continue;
      if (
        HAZARD_SEVERITY_ORDER.indexOf(event.severity) < HAZARD_SEVERITY_ORDER.indexOf(alert.minSeverity)
      ) {
        continue;
      }

      const distanceKm = haversineDistance({ lng: alert.lng, lat: alert.lat }, event.location) / 1000;
      if (distanceKm > alert.radiusKm) continue;

      const created = await this.notifications.create({
        userId: alert.userId,
        kind: 'hazard',
        severity: event.severity === 'extreme' ? 'critical' : event.severity === 'high' ? 'warning' : 'info',
        title: `${event.title}`,
        body: `${event.severity.toUpperCase()} ${event.kind} ${distanceKm.toFixed(0)} km from "${alert.name}". Source: ${event.source}.`,
        actionUrl: `${webAppUrl}/hazards?focus=${encodeURIComponent(event.id)}`,
        metadata: { hazardId: event.id, alertId: alert.id, distanceKm: Number(distanceKm.toFixed(1)) },
        email: alert.channels.includes('email'),
      });

      if (created) {
        sent += 1;
        await this.prisma.alert.update({
          where: { id: alert.id },
          data: { triggerCount: { increment: 1 }, lastTriggeredAt: new Date() },
        });
      }
    }

    await this.prisma.hazardEventCache
      .updateMany({ where: { externalId: event.id }, data: { notifiedAt: new Date() } })
      .catch(() => undefined);

    return sent;
  }
}
