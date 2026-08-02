import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { atLeastRole } from '@edt/shared';
import { RedisService } from 'src/infra/redis/redis.service';
import { AppException } from '../errors/app-exception';

const MAINTENANCE_KEY = 'system:maintenance';
const POLL_INTERVAL_MS = 5000;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

interface MaintenanceState {
  enabled: boolean;
  message: string | null;
}

/**
 * While maintenance mode is on, reads keep working but writes are refused for
 * everyone below admin. The flag is polled from Redis at most every 5 s so the
 * hot path stays synchronous and cheap.
 */
@Injectable()
export class MaintenanceGuard implements CanActivate {
  private cached: MaintenanceState = { enabled: false, message: null };
  private checkedAt = 0;

  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;

    const state = await this.state();
    if (!state.enabled) return true;

    const user = request.user;
    if (user && atLeastRole(user.role, 'admin')) return true;

    throw AppException.upstreamUnavailable(state.message ?? 'The platform is in maintenance mode', {
      maintenance: true,
    });
  }

  private async state(): Promise<MaintenanceState> {
    if (Date.now() - this.checkedAt < POLL_INTERVAL_MS) return this.cached;
    const stored = await this.redis.get<MaintenanceState>(MAINTENANCE_KEY);
    this.cached = stored ? stored.value : { enabled: false, message: null };
    this.checkedAt = Date.now();
    return this.cached;
  }
}
