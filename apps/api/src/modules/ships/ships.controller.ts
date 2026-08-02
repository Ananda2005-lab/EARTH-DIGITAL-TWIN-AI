import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  bboxStringSchema,
  shipQuerySchema,
  type BBox,
  type VesselFeed,
  type VesselKind,
  type VesselState,
} from '@edt/shared';
import { Attribution } from 'src/common/decorators/attribution.decorator';
import { CacheTtl } from 'src/common/decorators/cache-ttl.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { AppException } from 'src/common/errors/app-exception';
import { zodDto } from 'src/common/zod/zod-dto';
import { ShipsService, type RelayStatus } from './ships.service';

const VESSEL_KINDS = [
  'cargo',
  'tanker',
  'passenger',
  'fishing',
  'tug',
  'sailing',
  'high_speed',
  'military',
  'pleasure',
  'other',
] as const;

const seaportQuerySchema = z.object({
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/u)
    .transform((value) => value.toUpperCase())
    .optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export class ShipQueryDto extends zodDto(shipQuerySchema) {}
export class SeaportQueryDto extends zodDto(seaportQuerySchema) {}

function parseBbox(raw?: string): BBox | undefined {
  if (!raw) return undefined;
  const parsed = bboxStringSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

function parseKinds(raw?: string): VesselKind[] | undefined {
  if (!raw) return undefined;
  const parsed = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is VesselKind => (VESSEL_KINDS as readonly string[]).includes(value));
  return parsed.length > 0 ? parsed : undefined;
}

@ApiTags('ships')
@Controller('ships')
@Public()
@Attribution('AISStream · open AIS receivers')
export class ShipsController {
  constructor(private readonly ships: ShipsService) {}

  @Get()
  @CacheTtl(15)
  @ApiOperation({
    summary: 'Live vessel positions',
    description:
      'Served from the AIS snapshot maintained by the ships-relay collector. Returns an empty feed when AISSTREAM_API_KEY is not configured.',
  })
  @ApiOkResponse({ description: 'Vessel feed' })
  async feed(@Query() query: ShipQueryDto): Promise<VesselFeed> {
    return this.ships.feed({
      bbox: parseBbox(query.bbox),
      limit: query.limit,
      kinds: parseKinds(query.kinds),
      minSog: query.minSog,
    });
  }

  @Get('status')
  @ApiOperation({
    summary: 'AIS relay status',
    description: 'Whether the collector is connected and how many vessels are tracked.',
  })
  @ApiOkResponse({ description: 'Relay status' })
  async status(): Promise<RelayStatus> {
    return this.ships.relayStatus();
  }

  @Get('seaports')
  @CacheTtl(86_400)
  @Attribution('UNCTAD · World Port Index')
  @ApiOperation({ summary: 'Seaports from the gazetteer' })
  @ApiOkResponse({ description: 'Ports ranked by TEU throughput' })
  async seaports(
    @Query() query: SeaportQueryDto,
  ): Promise<
    {
      code: string;
      name: string;
      countryCode: string;
      lng: number;
      lat: number;
      teu: number | null;
    }[]
  > {
    return this.ships.seaports({ countryCode: query.countryCode, limit: query.limit });
  }

  @Get(':mmsi')
  @CacheTtl(15)
  @ApiOperation({ summary: 'One vessel by MMSI' })
  @ApiParam({ name: 'mmsi', example: '235095435' })
  @ApiOkResponse({ description: 'Vessel state' })
  @ApiResponse({ status: 404, description: 'Vessel not in the current snapshot' })
  async byMmsi(@Param('mmsi') mmsi: string): Promise<VesselState> {
    if (!/^\d{7,9}$/u.test(mmsi)) throw AppException.badRequest('MMSI must be 7 to 9 digits');
    const vessel = await this.ships.byMmsi(mmsi);
    if (!vessel) throw AppException.notFound('That vessel is not in the current AIS snapshot');
    return vessel;
  }
}
