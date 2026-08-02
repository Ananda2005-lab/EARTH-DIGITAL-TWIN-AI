import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminController } from './admin.controller';
import { AdminSystemController } from './admin-system.controller';
import { AdminService } from './admin.service';
import { ApiKeysService } from './api-keys.service';
import { FeatureFlagsService } from './feature-flags.service';
import { SystemService } from './system.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [AdminController, AdminSystemController],
  providers: [AdminService, ApiKeysService, FeatureFlagsService, SystemService],
  exports: [FeatureFlagsService, SystemService],
})
export class AdminModule {}
