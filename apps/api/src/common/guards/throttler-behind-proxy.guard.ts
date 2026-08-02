import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import type { Request } from 'express';
import { AppException } from '../errors/app-exception';

/**
 * Rate limits by the real client address when the API sits behind a load
 * balancer, and reports exhaustion with the shared `RATE_LIMITED` error code.
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected override async getTracker(request: Record<string, unknown>): Promise<string> {
    const typed = request as unknown as Request;
    const forwarded = typed.headers?.['x-forwarded-for'];
    const firstForwarded = Array.isArray(forwarded)
      ? forwarded[0]
      : typeof forwarded === 'string'
        ? forwarded.split(',')[0]
        : undefined;
    const apiKeyId = typed.user?.apiKeyId;
    const identity = apiKeyId ?? typed.user?.id;
    const ip = firstForwarded?.trim() || typed.ip || typed.socket?.remoteAddress || 'unknown';
    return identity ? `principal:${identity}` : `ip:${ip}`;
  }

  protected override async throwThrottlingException(
    _context: unknown,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw AppException.rateLimited('Rate limit exceeded, slow down', {
      limit: detail.limit,
      ttlSeconds: Math.ceil(detail.ttl / 1000),
    });
  }
}
