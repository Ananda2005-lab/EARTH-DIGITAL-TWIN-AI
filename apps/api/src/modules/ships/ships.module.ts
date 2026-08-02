import { Module } from '@nestjs/common';
import { ShipsController } from './ships.controller';
import { ShipsService } from './ships.service';

@Module({
  controllers: [ShipsController],
  providers: [ShipsService],
  exports: [ShipsService],
})
export class ShipsModule {}
