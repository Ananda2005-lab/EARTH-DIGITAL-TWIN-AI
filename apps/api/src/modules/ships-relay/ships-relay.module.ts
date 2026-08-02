import { Module } from '@nestjs/common';
import { ShipsRelayService } from './ships-relay.service';

/**
 * Background AIS collector. The service self-disables when no AISStream key is
 * configured, so the module can always be imported.
 */
@Module({
  providers: [ShipsRelayService],
  exports: [ShipsRelayService],
})
export class ShipsRelayModule {}
