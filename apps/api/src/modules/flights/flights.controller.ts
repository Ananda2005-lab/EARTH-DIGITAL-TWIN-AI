import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  bboxStringSchema,
  flightQuerySchema,
  type BBox,
  type FlightFeed,
  type FlightState,
} from '@edt/shared';
import { Attribution } from 'src/common/decorators/attribution.decorator';
import { CacheTtl } from 'src/common/decorators/cache-ttl.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { AppException } from 'src/common/errors/app-exception';
import { zodDto } from 'src/common/zod/zod-dto';
import { FlightsService } from './flights.service';

const airportQuerySchema = z.object({
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/u)
    .transform((value) => value.toUpperCase())
    .optional(),
  bbox: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export class FlightQueryDto extends zodDto(flightQuerySchema) {}
export class AirportQueryDto extends zodDto(airportQuerySchema) {}

function parseBbox(raw?: string): BBox | undefined {
  if (!raw) return undefined;
  const parsed = bboxStringSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

@ApiTags('flights')
@Controller('flights')
@Public()
@Attribution('OpenSky Network')
export class FlightsController {
  constructor(private readonly flights: FlightsService) {}

  @Get()
  @CacheTtl(20)
  @ApiOperation({
    summary: 'Live flight positions',
    description:
      'ADS-B state vectors, optionally constrained to a bbox. Cached for 20 s to respect OpenSky quotas.',
  })
  @ApiOkResponse({ description: 'Flight feed' })
  @ApiResponse({ status: 422, description: 'Invalid filter' })
  async feed(@Query() query: FlightQueryDto): Promise<FlightFeed> {
    return this.flights.feed({
      bbox: parseBbox(query.bbox),
      limit: query.limit,
      onGround: query.onGround,
      minAltitude: query.minAltitude,
      callsign: query.callsign,
    });
  }

  @Get('airports')
  @CacheTtl(86_400)
  @Attribution('OurAirports')
  @ApiOperation({ summary: 'Airports from the gazetteer' })
  @ApiOkResponse({ description: 'Airports ranked by throughput' })
  async airports(
    @Query() query: AirportQueryDto,
  ): Promise<
    {
      icao: string;
      iata: string | null;
      name: string;
      city: string | null;
      countryCode: string;
      lng: number;
      lat: number;
      passengers: number | null;
    }[]
  > {
    return this.flights.airports({
      countryCode: query.countryCode,
      bbox: parseBbox(query.bbox),
      limit: query.limit,
    });
  }

  @Get(':icao24')
  @CacheTtl(20)
  @ApiOperation({ summary: 'One aircraft by ICAO 24-bit address' })
  @ApiParam({ name: 'icao24', example: '4ca7b5' })
  @ApiOkResponse({ description: 'Flight state' })
  @ApiResponse({ status: 404, description: 'Aircraft not currently visible' })
  async byIcao(@Param('icao24') icao24: string): Promise<FlightState> {
    if (!/^[0-9a-fA-F]{6}$/u.test(icao24)) {
      throw AppException.badRequest('icao24 must be six hexadecimal characters');
    }
    const flight = await this.flights.byIcao24(icao24);
    if (!flight) throw AppException.notFound('That aircraft is not currently transmitting');
    return flight;
  }
}
