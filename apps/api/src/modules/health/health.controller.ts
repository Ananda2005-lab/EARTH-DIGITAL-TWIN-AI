import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PLATFORM, type HealthReport } from '@edt/shared';
import { Public } from 'src/common/decorators/public.decorator';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { RedisService } from 'src/infra/redis/redis.service';
import { UpstreamService } from 'src/infra/upstream/upstream.service';
import type { CircuitSnapshot } from 'src/infra/upstream/circuit-breaker';

/**
 * Liveness and readiness probes.
 *
 * `/health` is intentionally cheap and always 200 so a load balancer can tell
 * "process alive" from "dependency degraded"; `/health/ready` reflects the real
 * dependency state for rollout gating.
 */
@ApiTags('health')
@Controller('health')
@Public()
export class HealthController {
  private readonly bootedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly upstream: UpstreamService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Always 200 while the process can serve traffic.',
  })
  @ApiOkResponse({ description: 'Process is alive' })
  live(): { status: 'ok'; version: string; uptimeSeconds: number; timestamp: string } {
    return {
      status: 'ok',
      version: PLATFORM.version,
      uptimeSeconds: Math.round((Date.now() - this.bootedAt) / 1000),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness probe',
    description: 'Reports database, cache and upstream provider health.',
  })
  @ApiOkResponse({ description: 'Dependency health report' })
  @ApiResponse({
    status: 200,
    description: 'Always 200; inspect `status` for ok / degraded / down',
  })
  async ready(): Promise<HealthReport> {
    const checks: HealthReport['checks'] = [];

    try {
      const latencyMs = await this.prisma.ping();
      checks.push({ name: 'database', status: latencyMs > 750 ? 'degraded' : 'ok', latencyMs });
    } catch (error) {
      checks.push({
        name: 'database',
        status: 'down',
        detail: error instanceof Error ? error.message : 'probe failed',
      });
    }

    try {
      const latencyMs = await this.redis.ping();
      checks.push({ name: 'cache', status: latencyMs > 500 ? 'degraded' : 'ok', latencyMs });
    } catch (error) {
      checks.push({
        name: 'cache',
        status: 'degraded',
        detail: error instanceof Error ? error.message : 'probe failed',
      });
    }

    const open = this.upstream
      .circuitSnapshots()
      .filter((circuit: CircuitSnapshot) => circuit.state === 'open');
    checks.push({
      name: 'upstream-providers',
      status: open.length === 0 ? 'ok' : open.length > 3 ? 'down' : 'degraded',
      detail:
        open.length === 0
          ? 'all providers responding'
          : `open: ${open.map((circuit) => circuit.name).join(', ')}`,
    });

    return {
      status: checks.some((check) => check.status === 'down')
        ? 'down'
        : checks.some((check) => check.status === 'degraded')
          ? 'degraded'
          : 'ok',
      version: PLATFORM.version,
      uptimeSeconds: Math.round((Date.now() - this.bootedAt) / 1000),
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
