import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { HazardsService } from 'src/modules/hazards/hazards.service';
import { WeatherService } from 'src/modules/weather/weather.service';
import { QUEUE_NAMES, type CacheWarmJob } from '../queues';

/**
 * Pre-populates the Redis cache for the places users actually open, so the first
 * visitor after a TTL expiry does not pay the upstream latency. Failures are
 * swallowed per target: warming is opportunistic by definition.
 */
@Processor(QUEUE_NAMES.cacheWarm, { concurrency: 1 })
export class CacheWarmProcessor extends WorkerHost {
  private readonly logger = new Logger(CacheWarmProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly weather: WeatherService,
    private readonly hazards: HazardsService,
  ) {
    super();
  }

  async process(job: Job<CacheWarmJob>): Promise<{ warmed: number }> {
    const cities = await this.prisma.city.findMany({
      where: job.data.countryCodes?.length ? { countryCode: { in: job.data.countryCodes } } : {},
      orderBy: { population: 'desc' },
      take: 25,
      select: { name: true, lng: true, lat: true },
    });

    let warmed = 0;
    for (const city of cities) {
      const point = { lng: city.lng, lat: city.lat };
      const results = await Promise.allSettled([
        this.weather.forecast(point),
        this.weather.airQuality(point),
      ]);
      warmed += results.filter((result) => result.status === 'fulfilled').length;
    }

    await this.hazards.feed({ hours: 24, limit: 800 }).catch(() => undefined);
    this.logger.log(`Cache warm complete: ${warmed} payloads across ${cities.length} cities`);
    return { warmed };
  }
}
