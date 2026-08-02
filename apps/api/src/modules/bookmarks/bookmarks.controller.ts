import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  createBookmarkSchema,
  createCollectionSchema,
  idSchema,
  listBookmarksSchema,
  updateBookmarkSchema,
  type Bookmark,
  type BookmarkCollection,
  type PaginatedResult,
} from '@edt/shared';
import { ApiPaginatedResponse } from 'src/common/decorators/api-paginated-response.decorator';
import { Audit } from 'src/common/decorators/audit.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { RequirePermission } from 'src/common/decorators/permissions.decorator';
import { AppException } from 'src/common/errors/app-exception';
import type { AuthenticatedUser } from 'src/common/types/authenticated-user';
import { zodDto } from 'src/common/zod/zod-dto';
import { BookmarksService } from './bookmarks.service';

export class CreateBookmarkDto extends zodDto(createBookmarkSchema) {}
export class UpdateBookmarkDto extends zodDto(updateBookmarkSchema) {}
export class ListBookmarksDto extends zodDto(listBookmarksSchema) {}
export class CreateCollectionDto extends zodDto(createCollectionSchema) {}
export class UpdateCollectionDto extends zodDto(createCollectionSchema.partial()) {}

function assertUuid(value: string, label: string): string {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) throw AppException.badRequest(`${label} must be a UUID`);
  return parsed.data;
}

@ApiTags('bookmarks')
@ApiBearerAuth()
@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly bookmarks: BookmarksService) {}

  @Get()
  @ApiOperation({ summary: 'List your bookmarks', description: 'Pinned entries first, then by the chosen sort.' })
  @ApiPaginatedResponse({ type: 'object' }, 'Bookmarks')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListBookmarksDto,
  ): Promise<PaginatedResult<Bookmark>> {
    return this.bookmarks.list(user.id, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('bookmark:write')
  @Audit({ action: 'bookmark.create', resource: 'bookmark' })
  @ApiOperation({ summary: 'Create a bookmark' })
  @ApiBody({ schema: CreateBookmarkDto.openApiSchema })
  @ApiResponse({ status: 201, description: 'Bookmark created' })
  @ApiResponse({ status: 404, description: 'Collection not found' })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBookmarkDto): Promise<Bookmark> {
    return this.bookmarks.create(user.id, dto);
  }

  @Get('tags')
  @ApiOperation({ summary: 'Your bookmark tags with counts' })
  @ApiOkResponse({ description: 'Tag histogram' })
  async tags(@CurrentUser() user: AuthenticatedUser): Promise<{ tag: string; count: number }[]> {
    return this.bookmarks.tags(user.id);
  }

  @Get('collections')
  @ApiOperation({ summary: 'List your collections' })
  @ApiOkResponse({ description: 'Collections with bookmark counts' })
  async collections(@CurrentUser() user: AuthenticatedUser): Promise<BookmarkCollection[]> {
    return this.bookmarks.listCollections(user.id);
  }

  @Post('collections')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('bookmark:write')
  @Audit({ action: 'bookmark.collection_create', resource: 'bookmark_collection' })
  @ApiOperation({ summary: 'Create a collection' })
  @ApiBody({ schema: CreateCollectionDto.openApiSchema })
  @ApiResponse({ status: 201, description: 'Collection created' })
  @ApiResponse({ status: 409, description: 'Name already used' })
  async createCollection(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCollectionDto,
  ): Promise<BookmarkCollection> {
    return this.bookmarks.createCollection(user.id, dto);
  }

  @Patch('collections/:id')
  @RequirePermission('bookmark:write')
  @Audit({ action: 'bookmark.collection_update', resource: 'bookmark_collection', idParam: 'id' })
  @ApiOperation({ summary: 'Update a collection' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ schema: UpdateCollectionDto.openApiSchema })
  @ApiOkResponse({ description: 'Updated collection' })
  async updateCollection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCollectionDto,
  ): Promise<BookmarkCollection> {
    return this.bookmarks.updateCollection(user.id, assertUuid(id, 'Collection id'), dto);
  }

  @Delete('collections/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('bookmark:write')
  @Audit({ action: 'bookmark.collection_delete', resource: 'bookmark_collection', idParam: 'id' })
  @ApiOperation({ summary: 'Delete a collection', description: 'Its bookmarks are kept and become uncategorised.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Collection deleted' })
  async removeCollection(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.bookmarks.removeCollection(user.id, assertUuid(id, 'Collection id'));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one bookmark' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Bookmark' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Bookmark> {
    return this.bookmarks.get(user.id, assertUuid(id, 'Bookmark id'));
  }

  @Patch(':id')
  @RequirePermission('bookmark:write')
  @Audit({ action: 'bookmark.update', resource: 'bookmark', idParam: 'id' })
  @ApiOperation({ summary: 'Update a bookmark' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ schema: UpdateBookmarkDto.openApiSchema })
  @ApiOkResponse({ description: 'Updated bookmark' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateBookmarkDto,
  ): Promise<Bookmark> {
    return this.bookmarks.update(user.id, assertUuid(id, 'Bookmark id'), dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('bookmark:write')
  @Audit({ action: 'bookmark.delete', resource: 'bookmark', idParam: 'id' })
  @ApiOperation({ summary: 'Delete a bookmark' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Bookmark deleted' })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.bookmarks.remove(user.id, assertUuid(id, 'Bookmark id'));
  }
}
