import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  countryCodeSchema,
  idSchema,
  type AuditLogEntry,
  type FeatureFlag,
  type PaginatedResult,
  type Report,
  type UserProfile,
} from '@edt/shared';
import { ApiPaginatedResponse } from 'src/common/decorators/api-paginated-response.decorator';
import { Audit } from 'src/common/decorators/audit.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { RequirePermission } from 'src/common/decorators/permissions.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AppException } from 'src/common/errors/app-exception';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import type { AuthenticatedUser } from 'src/common/types/authenticated-user';
import { AuditService } from 'src/infra/audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminService, type AdminDashboard, type AiLogEntry } from './admin.service';
import { FeatureFlagsService } from './feature-flags.service';
import {
  AdminListUsersDto,
  AdminReportQueryDto,
  AdminUpdateUserDto,
  AiLogQueryDto,
  AuditQueryDto,
  BroadcastDto,
  FeatureFlagDto,
  FlagAiLogDto,
  PatchCityDto,
  PatchCountryDto,
} from './dto/admin.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@Roles('admin')
@UseGuards(RolesGuard, PermissionsGuard)
@ApiResponse({ status: 403, description: 'Requires the admin role' })
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly flags: FeatureFlagsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  @Get('overview')
  @RequirePermission('admin:read')
  @ApiOperation({ summary: 'Platform KPIs', description: 'User, content, AI and hazard counters plus 48 h of usage.' })
  @ApiOkResponse({ description: 'Dashboard metrics' })
  async overview(): Promise<AdminDashboard> {
    return this.admin.dashboard();
  }

  @Get('users')
  @RequirePermission('admin:users')
  @ApiOperation({ summary: 'List users' })
  @ApiPaginatedResponse({ type: 'object' }, 'Users')
  async users(
    @Query() query: AdminListUsersDto,
  ): Promise<PaginatedResult<UserProfile & { status: string; suspendedAt: string | null }>> {
    return this.admin.listUsers(query);
  }

  @Get('users/:id')
  @RequirePermission('admin:users')
  @ApiOperation({ summary: 'Get one user' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'User profile' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async user(@Param('id') id: string): Promise<UserProfile> {
    return this.admin.getUser(uuid(id, 'User id'));
  }

  @Patch('users/:id')
  @RequirePermission('admin:users')
  @Audit({ action: 'admin.user_update', resource: 'user', idParam: 'id' })
  @ApiOperation({
    summary: 'Update a user role, plan or suspension',
    description: 'Role changes and suspensions revoke every session for that user immediately.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ schema: AdminUpdateUserDto.openApiSchema })
  @ApiOkResponse({ description: 'Updated user' })
  @ApiResponse({ status: 403, description: 'Only an owner can manage owners' })
  async updateUser(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
  ): Promise<UserProfile> {
    return this.admin.updateUser(actor.role, uuid(id, 'User id'), dto);
  }

  @Get('reports')
  @RequirePermission('admin:read')
  @ApiOperation({ summary: 'All generated reports', description: 'Includes cost attribution per report.' })
  @ApiPaginatedResponse({ type: 'object' }, 'Reports')
  async reports(@Query() query: AdminReportQueryDto): Promise<PaginatedResult<Report & { userEmail: string }>> {
    return this.admin.listReports(query);
  }

  @Get('ai-logs')
  @RequirePermission('admin:read')
  @ApiOperation({ summary: 'AI usage log', description: 'Token spend, latency, failures and moderation flags.' })
  @ApiPaginatedResponse({ type: 'object' }, 'AI usage entries')
  async aiLogs(@Query() query: AiLogQueryDto): Promise<PaginatedResult<AiLogEntry>> {
    return this.admin.listAiLogs(query);
  }

  @Post('ai-logs/:id/flag')
  @RequirePermission('admin:content')
  @Audit({ action: 'admin.ai_log_flag', resource: 'ai_usage_log', idParam: 'id' })
  @ApiOperation({ summary: 'Flag or unflag an AI interaction' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ schema: FlagAiLogDto.openApiSchema })
  @ApiOkResponse({ description: 'Flag updated' })
  async flagAiLog(@Param('id') id: string, @Body() dto: FlagAiLogDto): Promise<{ flagged: boolean }> {
    await this.admin.flagAiLog(uuid(id, 'Log id'), dto.flagged);
    return { flagged: dto.flagged };
  }

  @Get('analytics')
  @RequirePermission('admin:read')
  @ApiOperation({ summary: 'Traffic and error budget series', description: 'Hourly roll-ups from usage_metrics.' })
  @ApiOkResponse({ description: 'Usage series' })
  async analytics(): Promise<AdminDashboard['usage']> {
    return (await this.admin.dashboard()).usage;
  }

  @Patch('countries/:code')
  @RequirePermission('admin:content')
  @Audit({ action: 'admin.country_update', resource: 'country', idParam: 'code' })
  @ApiOperation({ summary: 'Curate a country record' })
  @ApiParam({ name: 'code', example: 'KE' })
  @ApiBody({ schema: PatchCountryDto.openApiSchema })
  @ApiOkResponse({ description: 'Country updated' })
  @ApiResponse({ status: 404, description: 'Country not found' })
  async patchCountry(
    @Param('code') code: string,
    @Body() dto: PatchCountryDto,
  ): Promise<{ code: string; updatedAt: string }> {
    const parsed = countryCodeSchema.safeParse(code);
    if (!parsed.success) throw AppException.badRequest('Expected an ISO 3166-1 alpha-2 code');
    return this.admin.patchCountry(parsed.data, dto);
  }

  @Patch('cities/:id')
  @RequirePermission('admin:content')
  @Audit({ action: 'admin.city_update', resource: 'city', idParam: 'id' })
  @ApiOperation({ summary: 'Curate a city record' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ schema: PatchCityDto.openApiSchema })
  @ApiOkResponse({ description: 'City updated' })
  @ApiResponse({ status: 404, description: 'City not found' })
  async patchCity(@Param('id') id: string, @Body() dto: PatchCityDto): Promise<{ id: string; updatedAt: string }> {
    return this.admin.patchCity(uuid(id, 'City id'), dto);
  }

  @Get('feature-flags')
  @RequirePermission('admin:flags')
  @ApiOperation({ summary: 'List feature flags' })
  @ApiOkResponse({ description: 'Feature flags' })
  async featureFlags(): Promise<FeatureFlag[]> {
    return this.flags.list();
  }

  @Post('feature-flags')
  @RequirePermission('admin:flags')
  @Audit({ action: 'admin.flag_upsert', resource: 'feature_flag' })
  @ApiOperation({ summary: 'Create or update a feature flag', description: 'Rollout is a deterministic 0-100 percentage.' })
  @ApiBody({ schema: FeatureFlagDto.openApiSchema })
  @ApiOkResponse({ description: 'Flag saved' })
  async upsertFlag(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: FeatureFlagDto,
  ): Promise<FeatureFlag> {
    return this.flags.upsert(dto, actor.id);
  }

  @Post('notifications/broadcast')
  @RequirePermission('admin:content')
  @Audit({ action: 'admin.broadcast', resource: 'notification' })
  @ApiOperation({
    summary: 'Broadcast a notification',
    description: 'Sends immediately, or stores it for the scheduler when `scheduledFor` is in the future.',
  })
  @ApiBody({ schema: BroadcastDto.openApiSchema })
  @ApiOkResponse({ description: 'Recipient count' })
  async broadcast(@Body() dto: BroadcastDto): Promise<{ recipients: number; scheduled: boolean }> {
    return this.notifications.broadcast({
      kind: dto.kind,
      severity: dto.severity,
      title: dto.title,
      body: dto.body,
      actionUrl: dto.actionUrl ?? null,
      audience: dto.audience,
      scheduledFor: dto.scheduledFor ?? null,
    });
  }

  @Get('audit')
  @RequirePermission('admin:read')
  @ApiOperation({ summary: 'Audit trail', description: 'Immutable record of privileged actions.' })
  @ApiPaginatedResponse({ type: 'object' }, 'Audit entries')
  async auditLog(@Query() query: AuditQueryDto): Promise<PaginatedResult<AuditLogEntry>> {
    return this.audit.list(query);
  }
}

function uuid(value: string, label: string): string {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) throw AppException.badRequest(`${label} must be a UUID`);
  return parsed.data;
}
