import { AiService } from './ai.service';

function buildService() {
  const prisma = {
    conversation: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn(), delete: jest.fn() },
    chatMessage: { create: jest.fn(), findMany: jest.fn() },
    aiUsageLog: { aggregate: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  };
  const upstream = { json: jest.fn() };
  const aiConfig = { dailyTokenBudget: 1000, serviceUrl: 'http://ai', timeoutMs: 5000, token: 'secret', model: 'test-model' };
  const config = { get: jest.fn(() => aiConfig) };
  return { service: new AiService(prisma as never, upstream as never, config as never), prisma, upstream };
}

describe('AiService', () => {
  it('rejects calls after the daily token budget is exhausted', async () => {
    const { service, prisma, upstream } = buildService();
    prisma.aiUsageLog.aggregate.mockResolvedValue({ _sum: { totalTokens: 1000 } });

    await expect(service.chat('user-1', { message: 'Hello', stream: false }, 'request-1'))
      .rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(upstream.json).not.toHaveBeenCalled();
  });

  it('persists a successful chat exchange and returns mapped usage', async () => {
    const { service, prisma, upstream } = buildService();
    prisma.aiUsageLog.aggregate.mockResolvedValue({ _sum: { totalTokens: 0 } });
    prisma.conversation.create.mockResolvedValue({ id: 'conversation-1' });
    prisma.chatMessage.findMany.mockResolvedValue([]);
    prisma.chatMessage.create
      .mockResolvedValueOnce({ id: 'user-message' })
      .mockResolvedValueOnce({
        id: 'assistant-1', role: 'assistant', content: 'Answer', intent: null,
        citations: null, actions: null, tokensUsed: 7, latencyMs: 2, error: null,
        createdAt: new Date('2025-01-01T00:00:00Z'),
      });
    prisma.conversation.update.mockReturnValue({ operation: 'update' });
    prisma.aiUsageLog.create.mockReturnValue({ operation: 'usage' });
    prisma.$transaction.mockResolvedValue([]);
    upstream.json.mockResolvedValue({ data: {
      content: 'Answer', model: 'model-x', usage: { promptTokens: 3, completionTokens: 4, totalTokens: 7 },
    } });

    await expect(service.chat('user-1', { message: 'Hello', stream: false }, 'request-1'))
      .resolves.toMatchObject({
        conversationId: 'conversation-1', model: 'model-x',
        usage: { promptTokens: 3, completionTokens: 4, totalTokens: 7 },
        message: { content: 'Answer' },
      });
    expect(upstream.json).toHaveBeenCalledWith(expect.objectContaining({
      url: 'http://ai/v1/chat', method: 'POST', headers: { authorization: 'Bearer secret' },
    }));
  });

  it('records a fallback assistant message before surfacing upstream failure', async () => {
    const { service, prisma, upstream } = buildService();
    prisma.aiUsageLog.aggregate.mockResolvedValue({ _sum: { totalTokens: 0 } });
    prisma.conversation.create.mockResolvedValue({ id: 'conversation-1' });
    prisma.chatMessage.findMany.mockResolvedValue([]);
    prisma.chatMessage.create
      .mockResolvedValueOnce({ id: 'user-message' })
      .mockResolvedValueOnce({
        id: 'assistant-1', role: 'assistant', content: 'temporarily unavailable', intent: null,
        citations: null, actions: null, tokensUsed: 0, latencyMs: 1, error: 'offline', createdAt: new Date(),
      });
    prisma.conversation.update.mockReturnValue({});
    prisma.aiUsageLog.create.mockReturnValue({});
    prisma.$transaction.mockResolvedValue([]);
    upstream.json.mockRejectedValue(new Error('offline'));

    await expect(service.chat('user-1', { message: 'Hello', stream: false }, 'request-1'))
      .rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE', details: { conversationId: 'conversation-1' } });
    expect(prisma.chatMessage.create).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ role: 'assistant', error: 'offline' }),
    }));
  });

  it('returns usage with a non-negative remaining budget', async () => {
    const { service, prisma } = buildService();
    prisma.aiUsageLog.aggregate.mockResolvedValue({ _sum: { totalTokens: 1200 }, _count: { _all: 4 } });
    await expect(service.usage('user-1')).resolves.toMatchObject({
      totalTokens: 1200, requests: 4, budget: 1000, remaining: 0,
    });
  });
});
