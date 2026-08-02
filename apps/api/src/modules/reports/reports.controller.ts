import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  createReportSchema,
  idSchema,
  listReportsSchema,
  type PaginatedResult,
  type Report,
} from '@edt/shared';
import { ApiPaginatedResponse } from 'src/common/decorators/api-paginated-response.decorator';
import { Audit } from 'src/common/decorators/audit.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { RequirePermission } from 'src/common/decorators/permissions.decorator';
import { RawResponse } from 'src/common/decorators/raw-response.decorator';
import { AppException } from 'src/common/errors/app-exception';
import type { AuthenticatedUser } from 'src/common/types/authenticated-user';
import { zodDto } from 'src/common/zod/zod-dto';
import { ReportsService } from './reports.service';

export class CreateReportDto extends zodDto(createReportSchema) {}
export class ListReportsDto extends zodDto(listReportsSchema) {}

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @ApiOperation({ summary: 'List your reports' })
  @ApiPaginatedResponse({ type: 'object' }, 'Reports')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListReportsDto,
  ): Promise<PaginatedResult<Report>> {
    return this.reports.list(user.id, query);
  }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission('report:generate')
  @Audit({ action: 'report.create', resource: 'report' })
  @ApiOperation({
    summary: 'Request a report',
    description: 'Returns immediately with status `queued`; generation happens in the background queue.',
  })
  @ApiBody({ schema: CreateReportDto.openApiSchema })
  @ApiResponse({ status: 202, description: 'Report queued' })
  @ApiResponse({ status: 422, description: 'No usable target supplied' })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReportDto): Promise<Report> {
    return this.reports.create(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a report', description: 'Poll this while status is queued or generating.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Report' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Report> {
    return this.reports.get(user.id, this.uuid(id));
  }

  @Post(':id/retry')
  @RequirePermission('report:generate')
  @Audit({ action: 'report.retry', resource: 'report', idParam: 'id' })
  @ApiOperation({ summary: 'Retry a failed report' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Report re-queued' })
  @ApiResponse({ status: 409, description: 'Already generating' })
  async retry(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Report> {
    return this.reports.retry(user.id, this.uuid(id));
  }

  @Get(':id/export.md')
  @RawResponse()
  @ApiProduces('text/markdown')
  @Header('content-type', 'text/markdown; charset=utf-8')
  @ApiOperation({ summary: 'Download a report as Markdown' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Markdown document' })
  @ApiResponse({ status: 409, description: 'Report not ready' })
  async exportMarkdown(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<string> {
    const exported = await this.reports.exportMarkdown(user.id, this.uuid(id));
    return exported.body;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: 'report.delete', resource: 'report', idParam: 'id' })
  @ApiOperation({ summary: 'Delete a report' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.reports.remove(user.id, this.uuid(id));
  }

  private uuid(value: string): string {
    const parsed = idSchema.safeParse(value);
    if (!parsed.success) throw AppException.badRequest('Report id must be a UUID');
    return parsed.data;
  }
}
