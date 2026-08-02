import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  annotationSchema,
  createWorkspaceSchema,
  idSchema,
  paginationSchema,
  updateWorkspaceSchema,
  type Annotation,
  type PaginatedResult,
  type Workspace,
  type WorkspaceMember,
} from '@edt/shared';
import { ApiPaginatedResponse } from 'src/common/decorators/api-paginated-response.decorator';
import { Audit } from 'src/common/decorators/audit.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { RequirePermission } from 'src/common/decorators/permissions.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from 'src/common/guards/optional-jwt-auth.guard';
import { AppException } from 'src/common/errors/app-exception';
import type { AuthenticatedUser } from 'src/common/types/authenticated-user';
import { zodDto } from 'src/common/zod/zod-dto';
import { WorkspacesService } from './workspaces.service';

const listQuerySchema = paginationSchema.extend({ q: z.string().trim().max(120).optional() });
const memberSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(['viewer', 'editor']).default('viewer'),
});
const shareSchema = z.object({ visibility: z.enum(['team', 'public']).default('team') });

export class CreateWorkspaceDto extends zodDto(createWorkspaceSchema) {}
export class UpdateWorkspaceDto extends zodDto(updateWorkspaceSchema) {}
export class ListWorkspacesDto extends zodDto(listQuerySchema) {}
export class CreateAnnotationDto extends zodDto(annotationSchema) {}
export class AddMemberDto extends zodDto(memberSchema) {}
export class ShareWorkspaceDto extends zodDto(shareSchema) {}

function assertUuid(value: string, label: string): string {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) throw AppException.badRequest(`${label} must be a UUID`);
  return parsed.data;
}

@ApiTags('workspaces')
@ApiBearerAuth()
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  @ApiOperation({ summary: 'List workspaces you own or belong to' })
  @ApiPaginatedResponse({ type: 'object' }, 'Workspaces')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListWorkspacesDto,
  ): Promise<PaginatedResult<Workspace>> {
    return this.workspaces.list(user.id, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Audit({ action: 'workspace.create', resource: 'workspace' })
  @ApiOperation({ summary: 'Create a workspace' })
  @ApiBody({ schema: CreateWorkspaceDto.openApiSchema })
  @ApiResponse({ status: 201, description: 'Workspace created' })
  @ApiResponse({ status: 422, description: 'Unknown layer id or invalid view state' })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWorkspaceDto): Promise<Workspace> {
    return this.workspaces.create(user.id, dto);
  }

  @Get('shared/:slug')
  @Public()
  @ApiOperation({ summary: 'Open a shared workspace by slug', description: 'Works without authentication for public scenes.' })
  @ApiParam({ name: 'slug' })
  @ApiOkResponse({ description: 'Workspace' })
  @ApiResponse({ status: 404, description: 'Unknown or private workspace' })
  async shared(@Param('slug') slug: string): Promise<Workspace> {
    return this.workspaces.getByShareSlug(slug);
  }

  @Get(':id')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Get a workspace',
    description: 'Public workspaces are readable anonymously; private ones require membership.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Workspace' })
  @ApiResponse({ status: 403, description: 'Not a member' })
  async get(
    @CurrentUser({ optional: true }) user: AuthenticatedUser | undefined,
    @Param('id') id: string,
  ): Promise<Workspace> {
    return this.workspaces.get(user?.id ?? null, assertUuid(id, 'Workspace id'));
  }

  @Patch(':id')
  @Audit({ action: 'workspace.update', resource: 'workspace', idParam: 'id' })
  @ApiOperation({ summary: 'Update a workspace', description: 'Requires editor access.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ schema: UpdateWorkspaceDto.openApiSchema })
  @ApiOkResponse({ description: 'Updated workspace' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceDto,
  ): Promise<Workspace> {
    return this.workspaces.update(user.id, assertUuid(id, 'Workspace id'), dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: 'workspace.delete', resource: 'workspace', idParam: 'id' })
  @ApiOperation({ summary: 'Delete a workspace', description: 'Owner only.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Workspace deleted' })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.workspaces.remove(user.id, assertUuid(id, 'Workspace id'));
  }

  @Post(':id/annotations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add an annotation' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ schema: CreateAnnotationDto.openApiSchema })
  @ApiResponse({ status: 201, description: 'Annotation created' })
  async addAnnotation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateAnnotationDto,
  ): Promise<Annotation> {
    return this.workspaces.addAnnotation(user.id, assertUuid(id, 'Workspace id'), dto);
  }

  @Delete(':id/annotations/:annotationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an annotation' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'annotationId', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Annotation deleted' })
  async removeAnnotation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('annotationId') annotationId: string,
  ): Promise<void> {
    await this.workspaces.removeAnnotation(
      user.id,
      assertUuid(id, 'Workspace id'),
      assertUuid(annotationId, 'Annotation id'),
    );
  }

  @Post(':id/members')
  @RequirePermission('workspace:share')
  @Audit({ action: 'workspace.member_add', resource: 'workspace', idParam: 'id' })
  @ApiOperation({ summary: 'Invite a member', description: 'Owner only; requires the workspace:share capability.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ schema: AddMemberDto.openApiSchema })
  @ApiOkResponse({ description: 'Updated member list' })
  @ApiResponse({ status: 404, description: 'No user with that email' })
  async addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ): Promise<WorkspaceMember[]> {
    return this.workspaces.addMember(user.id, assertUuid(id, 'Workspace id'), dto.email, dto.role);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('workspace:share')
  @Audit({ action: 'workspace.member_remove', resource: 'workspace', idParam: 'id' })
  @ApiOperation({ summary: 'Remove a member', description: 'Owner only.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Member removed' })
  async removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') memberUserId: string,
  ): Promise<void> {
    await this.workspaces.removeMember(user.id, assertUuid(id, 'Workspace id'), assertUuid(memberUserId, 'User id'));
  }

  @Post(':id/share')
  @RequirePermission('workspace:share')
  @Audit({ action: 'workspace.share', resource: 'workspace', idParam: 'id' })
  @ApiOperation({ summary: 'Create or rotate the share link' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ schema: ShareWorkspaceDto.openApiSchema })
  @ApiOkResponse({ description: 'Share slug' })
  async share(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ShareWorkspaceDto,
  ): Promise<{ shareSlug: string }> {
    return this.workspaces.share(user.id, assertUuid(id, 'Workspace id'), dto.visibility);
  }
}
