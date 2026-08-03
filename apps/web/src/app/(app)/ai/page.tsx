import { NAV_ITEMS } from '@edt/shared';
import type { Metadata } from 'next';

import { ChatInterface } from '@/components/data/chat-interface';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = {
  title: 'AI Assistant',
  description: 'Context-aware planetary analyst with map control.',
};

export default function AiPage() {
  const navItem = NAV_ITEMS.find((item) => item.id === 'ai');

  return (
    <PageContainer className="flex h-full flex-col pb-5">
      <PageHeader
        eyebrow={<Badge variant="accent">Beta</Badge>}
        title="AI Assistant"
        description={navItem?.description ?? 'Context-aware planetary analyst with map control.'}
      />
      <div className="min-h-0 flex-1">
        <ChatInterface />
      </div>
    </PageContainer>
  );
}
