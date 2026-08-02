import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { AppConfig } from 'src/config/configuration';

export interface CachedEnvelope<T> {
  value: T;
  storedAt: number;
}

export interface CacheReadResult<T> {
  value: T;
  ageSeconds: number;
}

/**
 * Thin Redis façade for caching, rate accounting and the AIS snapshot store.
 *
 * Every method degrades to a miss/no-op if Redis is unreachable: a cache outage
 * must slow the platform down, not take it offline.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;
  private available = true;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    const redis = this.config.get('redis', { infer: true });
    this.client = new Redis(redis.url, {
      keyPrefix: redis.keyPrefix,
      lazyConnect: false,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      retryStrategy: (attempt) => Math.min(attempt * 200, 5000),
    });
    this.client.on('error', (error: Error) => {
      if (this.available) this.logger.warn(`Redis unavailable: ${error.message}`);
      this.available = false;
    });
    this.client.on('ready', () => {
      if (!this.available) this.logger.log('Redis connection restored');
      this.available = true;
    });
  }

  get raw(): Redis {
    return this.client;
  }

  get isAvailable(): boolean {
    return this.available;
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }

  async ping(): Promise<number> {
    const started = Date.now();
    await this.client.ping();
    return Date.now() - started;
  }

  async get<T>(key: string): Promise<CacheReadResult<T> | null> {
    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CachedEnvelope<T>;
      return {
        value: parsed.value,
        ageSeconds: Math.max(0, Math.round((Date.now() - parsed.storedAt) / 1000)),
      };
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      const envelope: CachedEnvelope<T> = { value, storedAt: Date.now() };
      await this.client.set(key, JSON.stringify(envelope), 'EX', Math.max(1, Math.floor(ttlSeconds)));
    } catch {
      // Cache writes are best-effort.
    }
  }

  /** Read-through helper: returns the cached value or computes and stores it. */
  async wrap<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<{ value: T; cached: boolean; ageSeconds: number }> {
    const hit = await this.get<T>(key);
    if (hit) return { value: hit.value, cached: true, ageSeconds: hit.ageSeconds };
    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return { value, cached: false, ageSeconds: 0 };
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    try {
      return await this.client.del(...keys);
    } catch {
      return 0;
    }
  }

  /** Delete by pattern using SCAN so a big keyspace never blocks the server. */
  async deleteByPattern(pattern: string): Promise<number> {
    const prefix = this.config.get('redis', { infer: true }).keyPrefix;
    let cursor = '0';
    let removed = 0;
    try {
      do {
        const [next, keys] = await this.client.scan(cursor, 'MATCH', `${prefix}${pattern}`, 'COUNT', 250);
        cursor = next;
        if (keys.length > 0) {
          // SCAN returns prefixed keys while the client re-applies keyPrefix on
          // write commands, so strip it before deleting.
          const unprefixed = keys.map((key) => (key.startsWith(prefix) ? key.slice(prefix.length) : key));
          removed += await this.client.del(...unprefixed);
        }
      } while (cursor !== '0');
    } catch {
      return removed;
    }
    return removed;
  }

  async incrementCounter(key: string, ttlSeconds: number): Promise<number> {
    try {
      const value = await this.client.incr(key);
      if (value === 1) await this.client.expire(key, ttlSeconds);
      return value;
    } catch {
      return 0;
    }
  }

  async hset(key: string, field: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      await this.client.hset(key, field, value);
      if (ttlSeconds) await this.client.expire(key, ttlSeconds);
    } catch {
      // best effort
    }
  }

  async hvals(key: string): Promise<string[]> {
    try {
      return await this.client.hvals(key);
    } catch {
      return [];
    }
  }

  async hlen(key: string): Promise<number> {
    try {
      return await this.client.hlen(key);
    } catch {
      return 0;
    }
  }

  async info(): Promise<Record<string, string>> {
    try {
      const raw = await this.client.info('memory');
      return raw
        .split('\n')
        .filter((line) => line.includes(':'))
        .reduce<Record<string, string>>((accumulator, line) => {
          const [key, value] = line.split(':');
          if (key && value) accumulator[key.trim()] = value.trim();
          return accumulator;
        }, {});
    } catch {
      return {};
    }
  }
}
