import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { HistoryEntry, PaginatedResult, UserProfile } from '@edt/shared';
import { ApiPaginatedResponse } from 'src/common/decorators/api-paginated-response.decorator';
import { Audit } from 'src/common/decorators/audit.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/common/types/authenticated-user';
import { ClearHistoryDto, HistoryQueryDto, RecordHistoryDto, UpdateProfileDto } from './dto/users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get your profile' })
  @ApiOkResponse({ description: 'The signed-in user profile' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<UserProfile> {
    return this.users.profile(user.id);
  }

  @Patch('me')
  @Audit({ action: 'user.profile_update', resource: 'user' })
  @ApiOperation({ summary: 'Update your profile' })
  @ApiBody({ schema: UpdateProfileDto.openApiSchema })
  @ApiOkResponse({ description: 'Updated profile' })
  @ApiResponse({ status: 422, description: 'Validation failed' })
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfile> {
    return this.users.updateProfile(user.id, dto);
  }

  @Get('me/history')
  @ApiOperation({ summary: 'List your activity history' })
  @ApiPaginatedResponse({ type: 'object' }, 'Activity history')
  async history(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: HistoryQueryDto,
  ): Promise<PaginatedResult<HistoryEntry>> {
    return this.users.history(user.id, query);
  }

  @Post('me/history')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record an activity entry', description: 'Used by the client to log searches and visits.' })
  @ApiBody({ schema: RecordHistoryDto.openApiSchema })
  @ApiResponse({ status: 201, description: 'Entry recorded' })
  async recordHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RecordHistoryDto,
  ): Promise<{ recorded: true }> {
    await this.users.recordHistory(user.id, dto);
    return { recorded: true };
  }

  @Delete('me/history')
  @Audit({ action: 'user.history_clear', resource: 'history_entry' })
  @ApiOperation({ summary: 'Clear your history', description: 'Optionally scoped to a single kind.' })
  @ApiOkResponse({ description: 'Number of removed entries' })
  async clearHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ClearHistoryDto,
  ): Promise<{ removed: number }> {
    return { removed: await this.users.clearHistory(user.id, query.kind) };
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: 'user.account_close', resource: 'user' })
  @ApiOperation({
    summary: 'Close your account',
    description: 'Anonymises the profile, destroys credentials and revokes every session. Irreversible.',
  })
  @ApiResponse({ status: 204, description: 'Account closed' })
  @ApiResponse({ status: 403, description: 'Owner accounts cannot be closed' })
  async close(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.users.closeAccount(user.id);
  }
}
