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
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { z } from 'zod';
import {
  aiChatSchema,
  aiCompareSchema,
  idSchema,
  paginationSchema,
  type AiChatResponse,
  type AiComparisonResult,
  type ChatMessage,
  type Conversation,
  type PaginatedResult,
} from '@edt/shared';
import { ApiPaginatedResponse } from 'src/common/decorators/api-paginated-response.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AppException } from 'src/common/errors/app-exception';
import type { AuthenticatedUser } from 'src/common/types/authenticated-user';
import { zodDto } from 'src/common/zod/zod-dto';
import { AiService, type AiUsageSummary } from './ai.service';

const renameSchema = z.object({ title: z.string().trim().min(1).max(160) });
const pinSchema = z.object({ pinned: z.boolean() });

export class AiChatDto extends zodDto(aiChatSchema) {}
export class AiCompareDto extends zodDto(aiCompareSchema) {}
export class ListConversationsDto extends zodDto(paginationSchema) {}
export class RenameConversationDto extends zodDto(renameSchema) {}
export class PinConversationDto extends zodDto(pinSchema) {}

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('chat')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Ask the planetary analyst',
    description:
      'Persists the exchange, injects the map context and enforces the per-user daily token budget. Rate limited to 30 messages per minute.',
  })
  @ApiBody({ schema: AiChatDto.openApiSchema })
  @ApiOkResponse({ description: 'Assistant reply with usage accounting' })
  @ApiResponse({ status: 429, description: 'Rate limited or daily token budget exhausted' })
  @ApiResponse({ status: 503, description: 'AI service unavailable' })
  async chat(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AiChatDto,
    @Req() request: Request,
  ): Promise<AiChatResponse> {
    return this.ai.chat(user.id, dto, request.requestId);
  }

  @Post('compare')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Compare countries or cities',
    description: 'Returns a narrative plus a dimension table.',
  })
  @ApiBody({ schema: AiCompareDto.openApiSchema })
  @ApiOkResponse({ description: 'Comparison result' })
  @ApiResponse({ status: 503, description: 'AI service unavailable' })
  async compare(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AiCompareDto,
    @Req() request: Request,
  ): Promise<AiComparisonResult> {
    return this.ai.compare(user.id, dto.targets, dto.dimensions, request.requestId);
  }

  @Get('usage')
  @ApiOperation({
    summary: 'Your AI usage today',
    description: 'Tokens consumed against the daily budget.',
  })
  @ApiOkResponse({ description: 'Usage summary' })
  async usage(@CurrentUser() user: AuthenticatedUser): Promise<AiUsageSummary> {
    return this.ai.usage(user.id);
  }

  @Get('conversations')
  @ApiOperation({
    summary: 'List your conversations',
    description: 'Pinned first, then most recently updated.',
  })
  @ApiPaginatedResponse({ type: 'object' }, 'Conversations')
  async conversations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListConversationsDto,
  ): Promise<PaginatedResult<Conversation>> {
    return this.ai.listConversations(user.id, query);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get the messages in a conversation' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Messages in chronological order' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async messages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ChatMessage[]> {
    return this.ai.conversationMessages(user.id, this.uuid(id));
  }

  @Patch('conversations/:id')
  @ApiOperation({ summary: 'Rename a conversation' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ schema: RenameConversationDto.openApiSchema })
  @ApiOkResponse({ description: 'Renamed' })
  async rename(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RenameConversationDto,
  ): Promise<{ renamed: true }> {
    await this.ai.renameConversation(user.id, this.uuid(id), dto.title);
    return { renamed: true };
  }

  @Post('conversations/:id/pin')
  @ApiOperation({ summary: 'Pin or unpin a conversation' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ schema: PinConversationDto.openApiSchema })
  @ApiOkResponse({ description: 'Updated' })
  async pin(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: PinConversationDto,
  ): Promise<{ pinned: boolean }> {
    await this.ai.setPinned(user.id, this.uuid(id), dto.pinned);
    return { pinned: dto.pinned };
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a conversation' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.ai.deleteConversation(user.id, this.uuid(id));
  }

  private uuid(value: string): string {
    const parsed = idSchema.safeParse(value);
    if (!parsed.success) throw AppException.badRequest('Conversation id must be a UUID');
    return parsed.data;
  }
}
