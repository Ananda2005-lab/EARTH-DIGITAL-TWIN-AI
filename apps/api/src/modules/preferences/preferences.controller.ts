import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { preferencesSchema, type UserPreferences } from '@edt/shared';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/common/types/authenticated-user';
import { zodDto } from 'src/common/zod/zod-dto';
import { PreferencesService } from './preferences.service';

export class UpdatePreferencesDto extends zodDto(preferencesSchema) {}

@ApiTags('preferences')
@ApiBearerAuth()
@Controller('preferences')
export class PreferencesController {
  constructor(private readonly preferences: PreferencesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get your preferences',
    description: 'Missing fields fall back to platform defaults.',
  })
  @ApiOkResponse({ description: 'Effective preferences' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async get(@CurrentUser() user: AuthenticatedUser): Promise<UserPreferences> {
    return this.preferences.get(user.id);
  }

  @Patch()
  @ApiOperation({
    summary: 'Update preferences',
    description: 'Partial update; layer ids are validated against the registry.',
  })
  @ApiBody({ schema: UpdatePreferencesDto.openApiSchema })
  @ApiOkResponse({ description: 'Updated preferences' })
  @ApiResponse({ status: 422, description: 'Unknown layer id or invalid value' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferencesDto,
  ): Promise<UserPreferences> {
    return this.preferences.update(user.id, dto);
  }

  @Post('reset')
  @ApiOperation({ summary: 'Restore default preferences' })
  @ApiOkResponse({ description: 'Defaults restored' })
  async reset(@CurrentUser() user: AuthenticatedUser): Promise<UserPreferences> {
    return this.preferences.reset(user.id);
  }
}
