import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { idSchema, type ApiKeyRecord } from '@edt/shared';
import { Audit } from 'src/common/decorators/audit.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { RequirePermission } from 'src/common/decorators/permissions.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AppException } from 'src/common/errors/app-exception';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import type { AuthenticatedUser } from 'src/common/types/authenticated-user';
import { PROVIDER_KEYS, type ProviderKey } from 'src/infra/upstream/providers';
import { ApiKeysService } from './api-keys.service';
import { FeatureFlagsService } from './feature-flags.service';
import { SystemService, type MaintenanceState, type SystemStatus } from './system.service';
import { CreateApiKeyDto, InvalidateCacheDto, ListApiKeysDto, MaintenanceDto } from './dto/admin.dto';

/**
 * Owner-only operations: credentials, caches, circuit breakers and maintenance
 * mode. Separated from the admin controller so the role boundary is explicit.
 */
@ApiTags('admin-system')
@ApiBearerAuth()
@Controller('admin/system')
@Roles('owner')
@UseGuards(RolesGuard, PermissionsGuard)
@ApiResponse({ status: 403, description: 'Requires the owner role' })
export class AdminSystemController {
  constructor(
    private readonly system: SystemService,
    private readonly apiKeys: ApiKeysService,
    private readonly flags: FeatureFlagsService,
  ) {}

  @Get()
  @RequirePermission('admin:system')
  @ApiOperation({
    summary: 'System status',
    description: 'Database and Redis probes, upstream circuit states, PostGIS availability and memory use.',
  })
  @ApiOkResponse({ description: 'System status' })
  async status(): Promise<SystemStatus> {
    return this.system.status();
  }

  @Post('maintenance')
  @RequirePermission('admin:system')
  @Audit({ action: 'admin.maintenance_toggle', resource: 'system' })
  @ApiOperation({
    summary: 'Toggle maintenance mode',
    description: 'While enabled, non-admin write requests are rejected with 503 across every instance.',
  })
  @ApiBody({ schema: MaintenanceDto.openApiSchema })
  @ApiOkResponse({ description: 'Maintenance state' })
  async maintenance(@Body() dto: MaintenanceDto): Promise<MaintenanceState> {
    return this.system.setMaintenance(dto.enabled, dto.message ?? null);
  }

  @Post('cache/invalidate')
  @RequirePermission('admin:system')
  @Audit({ action: 'admin.cache_invalidate', resource: 'system' })
  @ApiOperation({
    summary: 'Invalidate cached payloads',
    description: 'Pass a `provider` to clear one upstream namespace, or a Redis key `pattern`.',
  })
  @ApiBody({ schema: InvalidateCacheDto.openApiSchema })
  @ApiOkResponse({ description: 'Number of removed keys' })
  @ApiResponse({ status: 400, description: 'Unknown provider' })
  async invalidate(@Body() dto: InvalidateCacheDto): Promise<{ removed: number }> {
    if (dto.provider && !(PROVIDER_KEYS as string[]).includes(dto.provider)) {
      throw AppException.badRequest('Unknown upstream provider', { known: PROVIDER_KEYS });
    }
    return this.system.invalidateCache({
      pattern: dto.pattern,
      provider: dto.provider as ProviderKey | undefined,
    });
  }

  @Post('circuits/reset')
  @RequirePermission('admin:system')
  @Audit({ action: 'admin.circuit_reset', resource: 'system' })
  @ApiOperation({ summary: 'Close upstream circuit breakers', description: 'Omit `provider` to reset all of them.' })
  @ApiOkResponse({ description: 'Reset providers' })
  resetCircuits(@Query('provider') provider?: string): { reset: string[] } {
    if (provider && !(PROVIDER_KEYS as string[]).includes(provider)) {
      throw AppException.badRequest('Unknown upstream provider', { known: PROVIDER_KEYS });
    }
    return this.system.resetCircuits(provider as ProviderKey | undefined);
  }

  @Get('api-keys')
  @RequirePermission('admin:keys')
  @ApiOperation({ summary: 'List API keys', description: 'Only the last characters of each secret are ever returned.' })
  @ApiOkResponse({ description: 'API keys' })
  async listKeys(@Query() query: ListApiKeysDto): Promise<ApiKeyRecord[]> {
    return this.apiKeys.list(query.includeRevoked);
  }

  @Post('api-keys')
  @RequirePermission('admin:keys')
  @Audit({ action: 'admin.api_key_issue', resource: 'api_key' })
  @ApiOperation({
    summary: 'Issue an API key',
    description: 'The plaintext secret is returned exactly once; only its SHA-256 hash is stored.',
  })
  @ApiBody({ schema: CreateApiKeyDto.openApiSchema })
  @ApiOkResponse({ description: 'Issued key with its one-time secret' })
  async issueKey(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateApiKeyDto,
  ): Promise<{ record: ApiKeyRecord; secret: string }> {
    return this.apiKeys.issue(actor.id, {
      name: dto.name,
      scopes: dto.scopes,
      rateLimitPerMinute: dto.rateLimitPerMinute,
      expiresInDays: dto.expiresInDays ?? null,
    });
  }

  @Post('api-keys/:id/rotate')
  @RequirePermission('admin:keys')
  @Audit({ action: 'admin.api_key_rotate', resource: 'api_key', idParam: 'id' })
  @ApiOperation({ summary: 'Rotate an API key', description: 'Revokes the old secret and issues a replacement.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Replacement key with its one-time secret' })
  @ApiResponse({ status: 409, description: 'Key already revoked' })
  async rotateKey(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ record: ApiKeyRecord; secret: string }> {
    return this.apiKeys.rotate(this.uuid(id), actor.id);
  }

  @Delete('api-keys/:id')
  @RequirePermission('admin:keys')
  @Audit({ action: 'admin.api_key_revoke', resource: 'api_key', idParam: 'id' })
  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Revoked key' })
  async revokeKey(@Param('id') id: string): Promise<ApiKeyRecord> {
    return this.apiKeys.revoke(this.uuid(id));
  }

  @Delete('feature-flags/:key')
  @RequirePermission('admin:flags')
  @Audit({ action: 'admin.flag_delete', resource: 'feature_flag', idParam: 'key' })
  @ApiOperation({ summary: 'Delete a feature flag' })
  @ApiParam({ name: 'key', example: 'globe.time_machine' })
  @ApiOkResponse({ description: 'Flag deleted' })
  @ApiResponse({ status: 404, description: 'Flag not found' })
  async deleteFlag(@Param('key') key: string): Promise<{ deleted: true }> {
    await this.flags.remove(key);
    return { deleted: true };
  }

  private uuid(value: string): string {
    const parsed = idSchema.safeParse(value);
    if (!parsed.success) throw AppException.badRequest('Key id must be a UUID');
    return parsed.data;
  }
}
