import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { z } from 'zod';
import {
  idSchema,
  listNotificationsSchema,
  type NotificationItem,
  type PaginatedResult,
} from '@edt/shared';
import { ApiPaginatedResponse } from 'src/common/decorators/api-paginated-response.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AppException } from 'src/common/errors/app-exception';
import type { AuthenticatedUser } from 'src/common/types/authenticated-user';
import { zodDto } from 'src/common/zod/zod-dto';
import { NotificationsService, type NotificationPreferencesView } from './notifications.service';

const updatePreferencesSchema = z.object({
  channelInApp: z.boolean().optional(),
  channelEmail: z.boolean().optional(),
  channelWebhook: z.boolean().optional(),
  webhookUrl: z.string().url().max(512).nullish(),
  hazardMinSeverity: z.enum(['info', 'low', 'moderate', 'high', 'extreme']).optional(),
  digest: z.enum(['off', 'daily', 'weekly']).optional(),
  quietHoursStart: z.number().int().min(0).max(23).nullish(),
  quietHoursEnd: z.number().int().min(0).max(23).nullish(),
  mutedKinds: z
    .array(z.enum(['hazard', 'report', 'system', 'ai', 'billing', 'security']))
    .max(6)
    .optional(),
});

export class ListNotificationsDto extends zodDto(listNotificationsSchema) {}
export class UpdateNotificationPreferencesDto extends zodDto(updatePreferencesSchema) {}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List your notifications' })
  @ApiPaginatedResponse({ type: 'object' }, 'Notifications')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListNotificationsDto,
  ): Promise<PaginatedResult<NotificationItem>> {
    return this.notifications.list(user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread notification count', description: 'Drives the header badge.' })
  @ApiOkResponse({ description: 'Unread count' })
  async unreadCount(@CurrentUser() user: AuthenticatedUser): Promise<{ unread: number }> {
    return { unread: await this.notifications.unreadCount(user.id) };
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get delivery preferences' })
  @ApiOkResponse({ description: 'Notification preferences' })
  async preferences(@CurrentUser() user: AuthenticatedUser): Promise<NotificationPreferencesView> {
    return this.notifications.preferences(user.id);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update delivery preferences' })
  @ApiBody({ schema: UpdateNotificationPreferencesDto.openApiSchema })
  @ApiOkResponse({ description: 'Updated preferences' })
  @ApiResponse({ status: 422, description: 'Webhook enabled without a URL' })
  async updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesView> {
    return this.notifications.updatePreferences(user.id, dto);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark everything as read' })
  @ApiOkResponse({ description: 'Number of notifications marked read' })
  async markAllRead(@CurrentUser() user: AuthenticatedUser): Promise<{ updated: number }> {
    return { updated: await this.notifications.markAllRead(user.id) };
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark one notification as read' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Marked read' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.notifications.markRead(user.id, this.uuid(id));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.notifications.remove(user.id, this.uuid(id));
  }

  private uuid(value: string): string {
    const parsed = idSchema.safeParse(value);
    if (!parsed.success) throw AppException.badRequest('Notification id must be a UUID');
    return parsed.data;
  }
}
