import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { RedisService } from 'src/infra/redis/redis.service';
import { UpstreamService } from 'src/infra/upstream/upstream.service';
import type { CircuitSnapshot } from 'src/infra/upstream/circuit-breaker';

describe('HealthController', () => {
  const prismaMock = { ping: jest.fn() };
  const redisMock = { ping: jest.fn() };
  const upstreamMock = { circuitSnapshots: jest.fn() };

  let controller: HealthController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisMock },
        { provide: UpstreamService, useValue: upstreamMock },
      ],
    }).compile();
    controller = moduleRef.get(HealthController);
  });

  describe('live()', () => {
    it('reports ok with the platform version', () => {
      const result = controller.live();
      expect(result.status).toBe('ok');
      expect(result.version).toMatch(/^\d+\.\d+\.\d+$/u);
      expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(new Date(result.timestamp).getTime()).not.toBeNaN();
    });
  });

  describe('ready()', () => {
    it('reports ok when every dependency is healthy', async () => {
      prismaMock.ping.mockResolvedValue(20);
      redisMock.ping.mockResolvedValue(5);
      upstreamMock.circuitSnapshots.mockReturnValue([]);

      const result = await controller.ready();
      expect(result.status).toBe('ok');
      expect(result.checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'database', status: 'ok' }),
          expect.objectContaining({ name: 'cache', status: 'ok' }),
          expect.objectContaining({ name: 'upstream-providers', status: 'ok' }),
        ]),
      );
    });

    it('reports degraded for a slow database or cache', async () => {
      prismaMock.ping.mockResolvedValue(1000);
      redisMock.ping.mockResolvedValue(5);
      upstreamMock.circuitSnapshots.mockReturnValue([]);

      const result = await controller.ready();
      expect(result.status).toBe('degraded');
    });

    it('reports down when the database probe throws', async () => {
      prismaMock.ping.mockRejectedValue(new Error('connection refused'));
      redisMock.ping.mockResolvedValue(5);
      upstreamMock.circuitSnapshots.mockReturnValue([]);

      const result = await controller.ready();
      expect(result.status).toBe('down');
      expect(result.checks).toContainEqual(
        expect.objectContaining({ name: 'database', status: 'down' }),
      );
    });

    it('degrades when more than one upstream circuit is open', async () => {
      prismaMock.ping.mockResolvedValue(20);
      redisMock.ping.mockResolvedValue(5);
      upstreamMock.circuitSnapshots.mockReturnValue([
        { name: 'gdacs', state: 'open' } as CircuitSnapshot,
        { name: 'openskynetwork', state: 'open' } as CircuitSnapshot,
      ]);

      const result = await controller.ready();
      expect(result.status).toBe('degraded');
      expect(result.checks[2]).toEqual(
        expect.objectContaining({ name: 'upstream-providers', status: 'degraded' }),
      );
    });
  });
});
