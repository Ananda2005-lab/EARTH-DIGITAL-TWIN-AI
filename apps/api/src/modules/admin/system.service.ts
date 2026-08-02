import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { HealthReport } from '@edt/shared';
import { PLATFORM } from '@edt/shared';
import type { AppConfig } from 'src/config/configuration';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { RedisService } from 'src/infra/redis/redis.service';
import { UpstreamService } from 'src/infra/upstream/upstream.service';
import type { CircuitSnapshot } from 'src/infra/upstream/circuit-breaker';
import { PROVIDER_KEYS, type ProviderKey } from 'src/infra/upstream/providers';

export const MAINTENANCE_KEY = 'system:maintenance';

export interface MaintenanceState {
  enabled: boolean;
  message: string | null;
  since: string | null;
}

export interface SystemStatus extends HealthReport {
  maintenance: MaintenanceState;
  circuits: CircuitSnapshot[];
  postgis: boolean;
  memory: { rssMb: number; heapUsedMb: number };
  redisMemory: string | null;
}

/**
 * Platform operations surface: health, cache invalidation, circuit control and
 * maintenance mode. Maintenance state lives in Redis so every instance in a
 * horizontally scaled deployment observes it immediately.
 */
@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);
  private readonly bootedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly upstream: UpstreamService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async status(): Promise<SystemStatus> {
    const checks: HealthReport['checks'] = [];

    const database = await this.timed('database', () => this.prisma.ping());
    checks.push(database);
    const redis = await this.timed('redis', () => this.redis.ping());
    checks.push(redis);

    const circuits = this.upstream.circuitSnapshots();
    const openCircuits = circuits.filter((circuit) => circuit.state === 'open');
    checks.push({
      name: 'upstream-providers',
      status: openCircuits.length === 0 ? 'ok' : openCircuits.length > 3 ? 'down' : 'degraded',
      detail:
        openCircuits.length === 0
          ? 'all providers responding'
          : `open: ${openCircuits.map((circuit) => circuit.name).join(', ')}`,
    });

    const maintenance = await this.maintenance();
    const memory = process.memoryUsage();
    const redisInfo = await this.redis.info();

    const status: HealthReport['status'] = checks.some((check) => check.status === 'down')
      ? 'down'
      : checks.some((check) => check.status === 'degraded') || maintenance.enabled
        ? 'degraded'
        : 'ok';

    return {
      status,
      version: PLATFORM.version,
      uptimeSeconds: Math.round((Date.now() - this.bootedAt) / 1000),
      checks,
      timestamp: new Date().toISOString(),
      maintenance,
      circuits,
      postgis: await this.prisma.hasPostgis(),
      memory: {
        rssMb: Math.round(memory.rss / 1_048_576),
        heapUsedMb: Math.round(memory.heapUsed / 1_048_576),
      },
      redisMemory: redisInfo.used_memory_human ?? null,
    };
  }

  async maintenance(): Promise<MaintenanceState> {
    const stored = await this.redis.get<MaintenanceState>(MAINTENANCE_KEY);
    if (stored) return stored.value;
    const fromConfig = this.config.get('maintenanceMode', { infer: true });
    return { enabled: fromConfig, message: fromConfig ? 'Scheduled maintenance in progress' : null, since: null };
  }

  async setMaintenance(enabled: boolean, message: string | null): Promise<MaintenanceState> {
    const state: MaintenanceState = {
      enabled,
      message: enabled ? (message ?? 'Scheduled maintenance in progress') : null,
      since: enabled ? new Date().toISOString() : null,
    };
    if (enabled) {
      await this.redis.set(MAINTENANCE_KEY, state, 86_400);
    } else {
      await this.redis.del(MAINTENANCE_KEY);
    }
    this.logger.warn(`Maintenance mode ${enabled ? 'enabled' : 'disabled'}`);
    return state;
  }

  /** Invalidate cached payloads by pattern, or a whole provider namespace. */
  async invalidateCache(options: { pattern?: string; provider?: ProviderKey }): Promise<{ removed: number }> {
    if (options.provider) {
      return { removed: await this.upstream.invalidate(options.provider) };
    }
    const pattern = options.pattern ?? 'http:*';
    return { removed: await this.redis.deleteByPattern(pattern) };
  }

  resetCircuits(provider?: ProviderKey): { reset: string[] } {
    this.upstream.resetCircuit(provider);
    return { reset: provider ? [provider] : [...PROVIDER_KEYS] };
  }

  private async timed(
    name: string,
    probe: () => Promise<number>,
  ): Promise<{ name: string; status: 'ok' | 'degraded' | 'down'; latencyMs?: number; detail?: string }> {
    try {
      const latencyMs = await probe();
      return { name, status: latencyMs > 750 ? 'degraded' : 'ok', latencyMs };
    } catch (error) {
      return { name, status: 'down', detail: error instanceof Error ? error.message : 'probe failed' };
    }
  }
}
