import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import type {
  AiChatInput,
  AiChatResponse,
  AiCitation,
  AiComparisonResult,
  AiIntent,
  ChatMessage,
  Conversation,
  PaginatedResult,
  Report,
} from '@edt/shared';
import { AppException } from 'src/common/errors/app-exception';
import { Paginated } from 'src/common/pagination';
import type { AppConfig } from 'src/config/configuration';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { UpstreamService } from 'src/infra/upstream/upstream.service';

export interface AiUsageSummary {
  windowStart: string;
  totalTokens: number;
  requests: number;
  budget: number;
  remaining: number;
}

interface AiServiceChatResponse {
  content: string;
  intent?: AiIntent;
  citations?: AiCitation[];
  actions?: { kind: string; label: string; payload: Record<string, unknown> }[];
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  model?: string;
}

interface AiServiceComparisonResponse {
  narrative: string;
  table?: { dimension: string; values: Record<string, string> }[];
  winnerByDimension?: Record<string, string>;
  citations?: AiCitation[];
  usage?: { totalTokens?: number };
}

interface AiServiceReportResponse {
  title?: string;
  summary?: string;
  content: string;
  sections?: { heading: string; body: string; charts?: unknown }[];
  usage?: { totalTokens?: number };
}

/**
 * Gateway in front of the Python AI service.
 *
 * The gateway owns conversation state, cost accounting and the per-user daily
 * token budget; the model service stays stateless. Every call is logged to
 * `ai_usage_logs` whether it succeeded or not, which is what makes the admin
 * cost view trustworthy.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly upstream: UpstreamService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async chat(userId: string, input: AiChatInput, requestId: string): Promise<AiChatResponse> {
    const ai = this.config.get('ai', { infer: true });
    await this.assertWithinBudget(userId, ai.dailyTokenBudget);

    const conversation = input.conversationId
      ? await this.requireConversation(userId, input.conversationId)
      : await this.prisma.conversation.create({
          data: { userId, title: input.message.slice(0, 80) },
        });

    await this.prisma.chatMessage.create({
      data: { conversationId: conversation.id, role: 'user', content: input.message },
    });

    const startedAt = Date.now();
    let response: AiServiceChatResponse | null = null;
    let failure: string | null = null;

    try {
      const result = await this.upstream.json<AiServiceChatResponse>({
        provider: 'aiService',
        url: `${ai.serviceUrl}/v1/chat`,
        method: 'POST',
        ttl: 0,
        retries: 1,
        timeoutMs: ai.timeoutMs,
        headers: ai.token ? { authorization: `Bearer ${ai.token}` } : undefined,
        body: {
          message: input.message,
          context: input.context ?? null,
          intentHint: input.intentHint ?? null,
          history: await this.recentHistory(conversation.id),
          model: ai.model,
        },
      });
      response = result.data;
    } catch (error) {
      failure = error instanceof Error ? error.message : 'AI service unavailable';
    }

    const latencyMs = Date.now() - startedAt;
    const usage = {
      promptTokens: response?.usage?.promptTokens ?? 0,
      completionTokens: response?.usage?.completionTokens ?? 0,
      totalTokens: response?.usage?.totalTokens ?? 0,
    };

    const assistant = await this.prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content:
          response?.content ??
          'The analyst service is temporarily unavailable. Please try again shortly.',
        intent: response?.intent ?? null,
        citations: (response?.citations ?? undefined) as Prisma.InputJsonValue | undefined,
        actions: (response?.actions ?? undefined) as Prisma.InputJsonValue | undefined,
        tokensUsed: usage.totalTokens,
        latencyMs,
        error: failure,
      },
    });

    await this.prisma.$transaction([
      this.prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          messageCount: { increment: 2 },
          lastMessagePreview: assistant.content.slice(0, 160),
          updatedAt: new Date(),
        },
      }),
      this.prisma.aiUsageLog.create({
        data: {
          userId,
          conversationId: conversation.id,
          model: response?.model ?? ai.model,
          intent: response?.intent ?? null,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
          latencyMs,
          ok: failure === null,
          errorCode: failure === null ? null : 'UPSTREAM_UNAVAILABLE',
          requestId,
        },
      }),
    ]);

    if (failure) {
      throw AppException.upstreamUnavailable('The AI analyst is temporarily unavailable', {
        conversationId: conversation.id,
      });
    }

    return {
      conversationId: conversation.id,
      message: toChatMessage(assistant),
      usage,
      model: response?.model ?? ai.model,
    };
  }

  async compare(
    userId: string,
    targets: { kind: 'country' | 'city'; id: string }[],
    dimensions: string[] | undefined,
    requestId: string,
  ): Promise<AiComparisonResult> {
    const ai = this.config.get('ai', { infer: true });
    await this.assertWithinBudget(userId, ai.dailyTokenBudget);

    const startedAt = Date.now();
    const result = await this.upstream.json<AiServiceComparisonResponse>({
      provider: 'aiService',
      url: `${ai.serviceUrl}/v1/compare`,
      method: 'POST',
      ttl: 600,
      retries: 1,
      timeoutMs: ai.timeoutMs,
      headers: ai.token ? { authorization: `Bearer ${ai.token}` } : undefined,
      body: { targets, dimensions: dimensions ?? null, model: ai.model },
    });

    await this.logUsage(
      userId,
      ai.model,
      'compare_locations',
      result.data.usage?.totalTokens ?? 0,
      Date.now() - startedAt,
      requestId,
    );

    return {
      narrative: result.data.narrative,
      table: result.data.table ?? [],
      winnerByDimension: result.data.winnerByDimension ?? {},
      citations: result.data.citations ?? [],
    };
  }

  /** Generate report content. Called by the report queue processor. */
  async generateReportContent(
    userId: string,
    report: Pick<Report, 'id' | 'kind' | 'title' | 'target'> & {
      tone: string;
      includeCharts: boolean;
    },
    requestId: string,
  ): Promise<{
    title: string;
    summary: string;
    content: string;
    sections: { heading: string; body: string; charts?: unknown }[];
    tokensUsed: number;
  }> {
    const ai = this.config.get('ai', { infer: true });
    const startedAt = Date.now();

    const result = await this.upstream.json<AiServiceReportResponse>({
      provider: 'aiService',
      url: `${ai.serviceUrl}/v1/report`,
      method: 'POST',
      ttl: 0,
      retries: 1,
      timeoutMs: ai.timeoutMs,
      headers: ai.token ? { authorization: `Bearer ${ai.token}` } : undefined,
      body: {
        kind: report.kind,
        title: report.title,
        target: report.target,
        tone: report.tone,
        includeCharts: report.includeCharts,
        model: ai.model,
      },
    });

    const tokensUsed = result.data.usage?.totalTokens ?? 0;
    await this.logUsage(
      userId,
      ai.model,
      'generate_report',
      tokensUsed,
      Date.now() - startedAt,
      requestId,
    );

    return {
      title: result.data.title ?? report.title,
      summary: result.data.summary ?? '',
      content: result.data.content,
      sections: result.data.sections ?? [],
      tokensUsed,
    };
  }

  async listConversations(
    userId: string,
    query: { page: number; pageSize: number },
  ): Promise<PaginatedResult<Conversation>> {
    const where: Prisma.ConversationWhereInput = { userId, archivedAt: null };
    const { skip, take } = Paginated.skipTake(query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where,
        orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return Paginated.of(
      rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        title: row.title,
        messageCount: row.messageCount,
        pinned: row.pinned,
        lastMessagePreview: row.lastMessagePreview,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      total,
      query,
    );
  }

  async conversationMessages(userId: string, conversationId: string): Promise<ChatMessage[]> {
    await this.requireConversation(userId, conversationId);
    const rows = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toChatMessage);
  }

  async renameConversation(userId: string, conversationId: string, title: string): Promise<void> {
    await this.requireConversation(userId, conversationId);
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { title } });
  }

  async setPinned(userId: string, conversationId: string, pinned: boolean): Promise<void> {
    await this.requireConversation(userId, conversationId);
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { pinned } });
  }

  async deleteConversation(userId: string, conversationId: string): Promise<void> {
    await this.requireConversation(userId, conversationId);
    await this.prisma.conversation.delete({ where: { id: conversationId } });
  }

  async usage(userId: string): Promise<AiUsageSummary> {
    const budget = this.config.get('ai', { infer: true }).dailyTokenBudget;
    const windowStart = startOfDay(new Date());
    const aggregate = await this.prisma.aiUsageLog.aggregate({
      where: { userId, createdAt: { gte: windowStart } },
      _sum: { totalTokens: true },
      _count: { _all: true },
    });
    const totalTokens = aggregate._sum.totalTokens ?? 0;
    return {
      windowStart: windowStart.toISOString(),
      totalTokens,
      requests: aggregate._count._all,
      budget,
      remaining: Math.max(0, budget - totalTokens),
    };
  }

  private async assertWithinBudget(userId: string, budget: number): Promise<void> {
    if (budget <= 0) return;
    const aggregate = await this.prisma.aiUsageLog.aggregate({
      where: { userId, createdAt: { gte: startOfDay(new Date()) } },
      _sum: { totalTokens: true },
    });
    if ((aggregate._sum.totalTokens ?? 0) >= budget) {
      throw AppException.rateLimited('Daily AI token budget exhausted', { budget });
    }
  }

  private async requireConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    });
    if (!conversation) throw AppException.notFound('Conversation not found');
    return conversation;
  }

  private async recentHistory(
    conversationId: string,
  ): Promise<{ role: string; content: string }[]> {
    const rows = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { role: true, content: true },
    });
    return rows.reverse().map((row) => ({ role: row.role, content: row.content }));
  }

  private async logUsage(
    userId: string,
    model: string,
    intent: string,
    totalTokens: number,
    latencyMs: number,
    requestId: string,
  ): Promise<void> {
    await this.prisma.aiUsageLog
      .create({ data: { userId, model, intent, totalTokens, latencyMs, ok: true, requestId } })
      .catch((error: unknown) => {
        this.logger.warn(
          `Failed to log AI usage: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      });
  }
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

interface ChatMessageRow {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  intent: string | null;
  citations: Prisma.JsonValue | null;
  actions: Prisma.JsonValue | null;
  tokensUsed: number | null;
  latencyMs: number | null;
  error: string | null;
  createdAt: Date;
}

function toChatMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    intent: (row.intent ?? undefined) as AiIntent | undefined,
    citations: (row.citations ?? undefined) as AiCitation[] | undefined,
    actions: (row.actions ?? undefined) as ChatMessage['actions'],
    tokensUsed: row.tokensUsed ?? undefined,
    latencyMs: row.latencyMs ?? undefined,
    createdAt: row.createdAt.toISOString(),
    error: row.error,
  };
}
