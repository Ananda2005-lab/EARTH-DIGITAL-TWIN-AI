import { Module } from '@nestjs/common';
import { WeatherModule } from '../weather/weather.module';
import { EnvironmentController } from './environment.controller';
import { EnvironmentService } from './environment.service';

@Module({
  imports: [WeatherModule],
  controllers: [EnvironmentController],
  providers: [EnvironmentService],
  exports: [EnvironmentService],
})
export class EnvironmentModule {}
