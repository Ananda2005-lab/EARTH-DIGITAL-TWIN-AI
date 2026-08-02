import { Global, Module } from '@nestjs/common';
import { UpstreamService } from './upstream.service';

@Global()
@Module({
  providers: [UpstreamService],
  exports: [UpstreamService],
})
export class UpstreamModule {}
