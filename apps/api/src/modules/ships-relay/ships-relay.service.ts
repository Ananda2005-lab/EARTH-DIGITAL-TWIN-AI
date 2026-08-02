import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from 'src/config/configuration';
import { RedisService } from 'src/infra/redis/redis.service';
import {
  AIS_SNAPSHOT_KEY,
  AIS_STATUS_KEY,
  flagCountryFromMmsi,
  vesselKindFromAisType,
  type VesselSnapshot,
} from '../ships/ais.constants';
import { UPSTREAM_URLS } from 'src/infra/upstream/providers';

interface AisMetaData {
  MMSI?: number | string;
  ShipName?: string;
  latitude?: number;
  longitude?: number;
  time_utc?: string;
}

interface AisPositionReport {
  Latitude?: number;
  Longitude?: number;
  Sog?: number;
  Cog?: number;
  TrueHeading?: number;
  NavigationalStatus?: number;
  UserID?: number;
}

interface AisShipStaticData {
  Name?: string;
  CallSign?: string;
  Type?: number;
  Destination?: string;
  MaximumStaticDraught?: number;
  Dimension?: { A?: number; B?: number; C?: number; D?: number };
  Eta?: { Month?: number; Day?: number; Hour?: number; Minute?: number };
}

interface AisMessage {
  MessageType?: string;
  MetaData?: AisMetaData;
  Message?: {
    PositionReport?: AisPositionReport;
    StandardClassBPositionReport?: AisPositionReport;
    ShipStaticData?: AisShipStaticData;
  };
}

const NAV_STATUS: Record<number, string> = {
  0: 'Under way using engine',
  1: 'At anchor',
  2: 'Not under command',
  3: 'Restricted manoeuvrability',
  4: 'Constrained by draught',
  5: 'Moored',
  6: 'Aground',
  7: 'Engaged in fishing',
  8: 'Under way sailing',
  15: 'Undefined',
};

/**
 * AISStream websocket collector.
 *
 * Only starts when `AISSTREAM_API_KEY` is present. Positions are written to a
 * Redis hash keyed by MMSI with a TTL, so the HTTP tier reads a bounded snapshot
 * and the process can be restarted or scaled without losing correctness.
 * Reconnects use exponential backoff with jitter and never throw into the app.
 */
@Injectable()
export class ShipsRelayService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(ShipsRelayService.name);
  private socket: EdtWebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private staticCache = new Map<string, AisShipStaticData>();
  private attempts = 0;
  private stopped = false;
  private messagesReceived = 0;

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly redis: RedisService,
  ) {}

  onModuleInit(): void {
    const ships = this.config.get('ships', { infer: true });
    if (!ships.aisStreamKey) {
      this.logger.log('AISSTREAM_API_KEY not set — live vessel collection disabled');
      return;
    }
    if (typeof globalThis.WebSocket !== 'function') {
      this.logger.warn('No global WebSocket implementation available — vessel collection disabled');
      return;
    }
    this.connect();
  }

  onApplicationShutdown(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close(1000, 'shutting down');
    this.socket = null;
  }

  get stats(): { connected: boolean; messagesReceived: number; cachedStatics: number } {
    return {
      connected: this.socket !== null,
      messagesReceived: this.messagesReceived,
      cachedStatics: this.staticCache.size,
    };
  }

  private connect(): void {
    const ships = this.config.get('ships', { infer: true });
    const Constructor = globalThis.WebSocket;
    if (!Constructor || this.stopped) return;

    try {
      const socket = new Constructor(UPSTREAM_URLS.aisStream);
      this.socket = socket;

      socket.addEventListener('open', () => {
        this.attempts = 0;
        this.logger.log('AISStream connected');
        socket.send(
          JSON.stringify({
            APIKey: ships.aisStreamKey,
            BoundingBoxes: [
              [
                [ships.bbox[1], ships.bbox[0]],
                [ships.bbox[3], ships.bbox[2]],
              ],
            ],
            FilterMessageTypes: [
              'PositionReport',
              'StandardClassBPositionReport',
              'ShipStaticData',
            ],
          }),
        );
      });

      // Annotated because Node's ambient WebSocket types widen `data` to `any`.
      socket.addEventListener('message', (event: EdtWebSocketMessageEvent) => {
        void this.handleMessage(event.data);
      });

      socket.addEventListener('error', () => {
        this.logger.warn('AISStream socket error');
      });

      socket.addEventListener('close', (event) => {
        this.socket = null;
        if (this.stopped) return;
        this.logger.warn(`AISStream closed (${event.code}) — reconnecting`);
        this.scheduleReconnect();
      });
    } catch (error) {
      this.logger.warn(`AISStream connection failed: ${(error as Error).message}`);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    this.attempts = Math.min(this.attempts + 1, 8);
    const ceiling = Math.min(1000 * 2 ** this.attempts, 60_000);
    const wait = Math.round(ceiling / 2 + Math.random() * (ceiling / 2));
    this.reconnectTimer = setTimeout(() => this.connect(), wait);
  }

  private async handleMessage(data: string | ArrayBuffer | Uint8Array): Promise<void> {
    const text =
      typeof data === 'string'
        ? data
        : Buffer.from(data instanceof ArrayBuffer ? new Uint8Array(data) : data).toString('utf8');

    let message: AisMessage;
    try {
      message = JSON.parse(text) as AisMessage;
    } catch {
      return;
    }

    const mmsi = String(
      message.MetaData?.MMSI ?? message.Message?.PositionReport?.UserID ?? '',
    ).trim();
    if (!mmsi) return;
    this.messagesReceived += 1;

    if (message.Message?.ShipStaticData) {
      this.rememberStatic(mmsi, message.Message.ShipStaticData);
    }

    const report = message.Message?.PositionReport ?? message.Message?.StandardClassBPositionReport;
    const lat = report?.Latitude ?? message.MetaData?.latitude;
    const lng = report?.Longitude ?? message.MetaData?.longitude;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const staticData = this.staticCache.get(mmsi);
    const dimension = staticData?.Dimension;
    const snapshot: VesselSnapshot = {
      mmsi,
      name: (staticData?.Name ?? message.MetaData?.ShipName ?? '').trim() || null,
      callsign: staticData?.CallSign?.trim() || null,
      kind: vesselKindFromAisType(staticData?.Type),
      flagCountryCode: flagCountryFromMmsi(mmsi),
      lng: lng as number,
      lat: lat as number,
      sog: report?.Sog ?? null,
      cog: report?.Cog ?? null,
      heading: report?.TrueHeading === 511 ? null : (report?.TrueHeading ?? null),
      navStatus:
        report?.NavigationalStatus === undefined
          ? null
          : (NAV_STATUS[report.NavigationalStatus] ?? null),
      destination: staticData?.Destination?.trim() || null,
      eta: formatEta(staticData?.Eta),
      draughtM: staticData?.MaximumStaticDraught ?? null,
      lengthM: dimension ? (dimension.A ?? 0) + (dimension.B ?? 0) || null : null,
      widthM: dimension ? (dimension.C ?? 0) + (dimension.D ?? 0) || null : null,
      lastContact: message.MetaData?.time_utc ?? new Date().toISOString(),
    };

    const ships = this.config.get('ships', { infer: true });
    await this.redis.hset(AIS_SNAPSHOT_KEY, mmsi, JSON.stringify(snapshot), ships.snapshotTtl * 30);
    await this.redis.set(AIS_STATUS_KEY, { lastMessageAt: new Date().toISOString() }, 300);
  }

  /** Static reports are rare; keep a bounded cache so names survive restarts. */
  private rememberStatic(mmsi: string, data: AisShipStaticData): void {
    if (this.staticCache.size > 20_000) {
      const oldest = this.staticCache.keys().next().value;
      if (oldest !== undefined) this.staticCache.delete(oldest);
    }
    this.staticCache.set(mmsi, data);
  }
}

function formatEta(eta?: {
  Month?: number;
  Day?: number;
  Hour?: number;
  Minute?: number;
}): string | null {
  if (!eta?.Month || !eta.Day) return null;
  const year = new Date().getUTCFullYear();
  const month = String(eta.Month).padStart(2, '0');
  const day = String(eta.Day).padStart(2, '0');
  const hour = String(eta.Hour ?? 0).padStart(2, '0');
  const minute = String(eta.Minute ?? 0).padStart(2, '0');
  const candidate = new Date(`${year}-${month}-${day}T${hour}:${minute}:00Z`);
  return Number.isNaN(candidate.getTime()) ? null : candidate.toISOString();
}
