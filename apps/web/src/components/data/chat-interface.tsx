'use client';

import type { AiChatRequest, AiChatResponse, ChatMessage } from '@edt/shared';
import { Bot, LogIn, Send, Sparkles, TriangleAlert, UserRound } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api, ApiError, describeError } from '@/lib/api/client';
import { cn, createId } from '@/lib/utils';

const SUGGESTED_PROMPTS = [
  'Compare Japan and Germany',
  "Explain today's Kp index",
  "Explain Kenya's economy",
  'Plan a 5-day trip to Iceland',
];

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
}

/**
 * Request/response chat for v1 — no SSE streaming. The gateway may well be
 * unreachable while this is developed and login is not wired up yet, so every
 * failure path has to degrade to a readable message instead of breaking the
 * page: unauthorised gets an inline sign-in prompt, everything else gets a
 * toast plus an inline error bubble.
 */
export function ChatInterface() {
  const [messages, setMessages] = React.useState<DisplayMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [conversationId, setConversationId] = React.useState<string | undefined>(undefined);
  const [unauthorised, setUnauthorised] = React.useState(false);

  const scrollAnchorRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, pending]);

  const send = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending) return;

      const userMessage: DisplayMessage = { id: createId('msg'), role: 'user', content: trimmed };
      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setPending(true);
      setUnauthorised(false);

      try {
        const body: AiChatRequest = {
          message: trimmed,
          conversationId,
          stream: false,
        };
        const response = await api<AiChatResponse>('/ai/chat', {
          method: 'POST',
          body,
        });
        setConversationId(response.conversationId);
        const reply = response.message as ChatMessage;
        setMessages((prev) => [
          ...prev,
          { id: reply.id, role: 'assistant', content: reply.content },
        ]);
      } catch (error) {
        if (error instanceof ApiError && error.isUnauthorised) {
          setUnauthorised(true);
          setMessages((prev) => [
            ...prev,
            {
              id: createId('msg'),
              role: 'assistant',
              content: 'Sign in to chat with the assistant.',
              error: true,
            },
          ]);
          return;
        }

        const { title, description } = describeError(error);
        toast.error(title, { description });
        setMessages((prev) => [
          ...prev,
          {
            id: createId('msg'),
            role: 'assistant',
            content: description,
            error: true,
          },
        ]);
      } finally {
        setPending(false);
      }
    },
    [conversationId, pending],
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void send(input);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send(input);
    }
  };

  const fillPrompt = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  return (
    <Card className="flex h-full flex-col overflow-hidden p-0">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 px-4 py-5 sm:px-6">
          {messages.length === 0 ? (
            <WelcomeState onPick={fillPrompt} />
          ) : (
            messages.map((message) => <MessageBubble key={message.id} message={message} />)
          )}
          {pending ? <TypingBubble /> : null}
          <div ref={scrollAnchorRef} />
        </div>
      </ScrollArea>

      <div className="border-border/60 border-t px-4 py-3 sm:px-6">
        {unauthorised ? (
          <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs">
            <LogIn className="size-3.5" aria-hidden />
            Sign in to chat with the assistant.
          </p>
        ) : null}

        {messages.length > 0 ? (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => fillPrompt(prompt)}
                className="border-border bg-surface-muted hover:bg-surface-strong hover:text-foreground text-muted-foreground rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about any place on Earth…"
            disabled={pending}
            rows={1}
            className="max-h-40 min-h-10 flex-1 resize-none py-2.5"
          />
          <Button type="submit" size="icon" disabled={pending || input.trim().length === 0}>
            <Send />
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </div>
    </Card>
  );
}

function WelcomeState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
      <div className="bg-primary/12 text-primary mb-4 inline-flex size-12 items-center justify-center rounded-2xl">
        <Sparkles className="size-6" aria-hidden />
      </div>
      <p className="display-tight text-lg">Ask the planetary analyst</p>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
        Context-aware answers about any country, city or place on Earth, with the current map state
        taken into account.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPick(prompt)}
            className="border-border bg-surface-muted hover:bg-surface-strong hover:text-foreground text-muted-foreground rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: DisplayMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex items-start gap-3', isUser && 'flex-row-reverse')}>
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className={message.error ? 'from-destructive/25 to-destructive/10' : ''}>
          {isUser ? <UserRound className="size-4" /> : <Bot className="size-4" />}
        </AvatarFallback>
      </Avatar>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground'
            : message.error
              ? 'border-destructive/30 bg-destructive/10 text-destructive border'
              : 'glass glass-highlight',
        )}
      >
        {message.error ? (
          <span className="mb-1 flex items-center gap-1.5 text-xs font-medium">
            <TriangleAlert className="size-3.5" aria-hidden />
            Couldn&apos;t reach the assistant
          </span>
        ) : null}
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-start gap-3">
      <Avatar className="size-8 shrink-0">
        <AvatarFallback>
          <Bot className="size-4" />
        </AvatarFallback>
      </Avatar>
      <div className="glass glass-highlight flex items-center gap-1.5 rounded-2xl px-4 py-3">
        <span className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" />
        <span className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" />
        <span className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full" />
      </div>
    </div>
  );
}
