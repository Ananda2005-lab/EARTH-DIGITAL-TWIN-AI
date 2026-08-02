import { Module } from '@nestjs/common';
import { HazardsController } from './hazards.controller';
import { HazardsService } from './hazards.service';

@Module({
  controllers: [HazardsController],
  providers: [HazardsService],
  exports: [HazardsService],
})
export class HazardsModule {}
