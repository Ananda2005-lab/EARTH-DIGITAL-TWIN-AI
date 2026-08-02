import { Injectable } from '@nestjs/common';
import { bboxContains, type BBox, type VesselFeed, type VesselKind, type VesselState } from '@edt/shared';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { RedisService } from 'src/infra/redis/redis.service';
import { AIS_SNAPSHOT_KEY, AIS_STATUS_KEY, type VesselSnapshot } from './ais.constants';

export interface ShipQuery {
  bbox?: BBox;
  limit: number;
  kinds?: VesselKind[];
  minSog?: number;
}

export interface RelayStatus {
  connected: boolean;
  vesselCount: number;
  lastMessageAt: string | null;
}

/**
 * Reads the AIS snapshot maintained by the ships-relay collector.
 *
 * The relay keeps a Redis hash of the newest position per MMSI; this service
 * only filters and projects it, so the HTTP path never touches the websocket.
 */
@Injectable()
export class ShipsService {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async feed(query: ShipQuery): Promise<VesselFeed> {
    const raw = await this.redis.hvals(AIS_SNAPSHOT_KEY);
    const vessels = raw
      .map((entry) => parseSnapshot(entry))
      .filter((snapshot): snapshot is VesselSnapshot => snapshot !== null)
      .map((snapshot) => toVesselState(snapshot))
      .filter((vessel) => {
        if (query.bbox && !bboxContains(query.bbox, vessel.position)) return false;
        if (query.kinds && query.kinds.length > 0 && !query.kinds.includes(vessel.kind)) return false;
        if (query.minSog !== undefined && (vessel.sog ?? 0) < query.minSog) return false;
        return true;
      })
      .sort((a, b) => (b.sog ?? 0) - (a.sog ?? 0));

    return {
      vessels: vessels.slice(0, query.limit),
      total: vessels.length,
      bbox: query.bbox,
      attribution: 'AISStream · open AIS receivers',
      fetchedAt: new Date().toISOString(),
    };
  }

  async byMmsi(mmsi: string): Promise<VesselState | null> {
    const raw = await this.redis.raw.hget(AIS_SNAPSHOT_KEY, mmsi).catch(() => null);
    const snapshot = raw ? parseSnapshot(raw) : null;
    return snapshot ? toVesselState(snapshot) : null;
  }

  async relayStatus(): Promise<RelayStatus> {
    const [count, status] = await Promise.all([
      this.redis.hlen(AIS_SNAPSHOT_KEY),
      this.redis.get<{ lastMessageAt: string }>(AIS_STATUS_KEY),
    ]);
    return {
      connected: Boolean(status && Date.now() - new Date(status.value.lastMessageAt).getTime() < 120_000),
      vesselCount: count,
      lastMessageAt: status?.value.lastMessageAt ?? null,
    };
  }

  /** Container ports from the gazetteer, ranked by throughput. */
  async seaports(options: { countryCode?: string; limit: number }): Promise<
    { code: string; name: string; countryCode: string; lng: number; lat: number; teu: number | null }[]
  > {
    const rows = await this.prisma.seaport.findMany({
      where: { countryCode: options.countryCode?.toUpperCase() },
      orderBy: [{ teu: 'desc' }, { name: 'asc' }],
      take: options.limit,
    });
    return rows.map((row) => ({
      code: row.code,
      name: row.name,
      countryCode: row.countryCode,
      lng: row.lng,
      lat: row.lat,
      teu: row.teu === null ? null : Number(row.teu),
    }));
  }
}

function parseSnapshot(raw: string): VesselSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as VesselSnapshot;
    return Number.isFinite(parsed.lng) && Number.isFinite(parsed.lat) ? parsed : null;
  } catch {
    return null;
  }
}

function toVesselState(snapshot: VesselSnapshot): VesselState {
  return {
    mmsi: snapshot.mmsi,
    name: snapshot.name,
    callsign: snapshot.callsign,
    kind: snapshot.kind,
    flagCountryCode: snapshot.flagCountryCode,
    position: { lng: snapshot.lng, lat: snapshot.lat },
    sog: snapshot.sog,
    cog: snapshot.cog,
    heading: snapshot.heading,
    navStatus: snapshot.navStatus,
    destination: snapshot.destination,
    eta: snapshot.eta,
    draughtM: snapshot.draughtM,
    lengthM: snapshot.lengthM,
    widthM: snapshot.widthM,
    lastContact: snapshot.lastContact,
  };
}
