import { formatRelativeTime, type HistoryEntry, type PaginatedResult } from '@edt/shared';
import type { Metadata } from 'next';

import { RequireAuthNotice } from '@/components/data/require-auth-notice';
import { PageContainer, PageHeader, Section } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api/client';

import { ClearHistoryButton } from './clear-history-button';
import { HistoryKindIcon, KIND_LABEL } from './history-kind-icon';

export const metadata: Metadata = {
  title: 'History',
  description:
    'Everywhere you have been and everything you asked — searches, places, reports and AI questions, newest first.',
};

interface SampleHistoryEntry {
  id: string;
  kind: HistoryEntry['kind'];
  label: string;
  detail: string | null;
  createdAt: string;
}

const SAMPLE_HISTORY: SampleHistoryEntry[] = [
  {
    id: 'sample-1',
    kind: 'ai',
    label: 'Asked AI: What is driving the drought in the Horn of Africa?',
    detail: null,
    createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
  },
  {
    id: 'sample-2',
    kind: 'place',
    label: 'Viewed Nairobi, Kenya',
    detail: null,
    createdAt: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
  },
  {
    id: 'sample-3',
    kind: 'search',
    label: 'Searched "coral bleaching 2024"',
    detail: null,
    createdAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
  },
  {
    id: 'sample-4',
    kind: 'place',
    label: 'Viewed Reykjavík, Iceland',
    detail: null,
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sample-5',
    kind: 'ai',
    label: 'Asked AI: Compare flood risk between Bangladesh and Vietnam',
    detail: null,
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sample-6',
    kind: 'report',
    label: 'Generated report: Japan — Country Profile',
    detail: null,
    createdAt: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sample-7',
    kind: 'layer',
    label: 'Enabled layer: Active wildfires',
    detail: null,
    createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sample-8',
    kind: 'place',
    label: 'Viewed Cape Town, South Africa',
    detail: null,
    createdAt: new Date(Date.now() - 32 * 60 * 60 * 1000).toISOString(),
  },
];

// Reads the signed-in user's activity log, which is per-request data.
export const dynamic = 'force-dynamic';

async function loadHistory(): Promise<PaginatedResult<HistoryEntry> | null> {
  try {
    return await api<PaginatedResult<HistoryEntry>>('/users/me/history', {
      query: { pageSize: 100 },
    });
  } catch {
    return null;
  }
}

export default async function HistoryPage() {
  const history = await loadHistory();

  return (
    <PageContainer>
      <PageHeader
        eyebrow={history ? <Badge variant="primary">{history.total} entries</Badge> : undefined}
        title="History"
        description="Searches, places, reports and layers you have touched, newest first."
        actions={history && history.items.length > 0 ? <ClearHistoryButton /> : undefined}
      />

      {!history ? (
        <RequireAuthNotice description="Sign in to see your history." />
      ) : history.items.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="display-tight text-base">No activity yet</p>
          <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
            Searches, saved places and generated reports will start showing up here.
          </p>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-border/60 divide-y">
              {history.items.map((entry) => (
                <HistoryRow key={entry.id} entry={entry} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {!history ? <HistoryPreviewSection /> : null}
    </PageContainer>
  );
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <span className="bg-surface-muted text-muted-foreground mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg">
        <HistoryKindIcon kind={entry.kind} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{entry.label}</p>
        <p className="text-muted-foreground mt-0.5 truncate text-xs">
          {entry.detail ? `${entry.detail} · ` : ''}
          {formatRelativeTime(entry.createdAt)}
        </p>
      </div>
      <Badge variant="neutral" className="mt-0.5 shrink-0">
        {KIND_LABEL[entry.kind]}
      </Badge>
    </li>
  );
}

/**
 * Sample-data walkthrough shown only when signed out, so signed-in users see
 * only their real data — none of this is fetched.
 */
function HistoryPreviewSection() {
  return (
    <Section
      title="What this looks like"
      description="A sample activity feed mixing viewed places and questions asked of the AI assistant."
      actions={<Badge variant="secondary">Preview</Badge>}
      className="mt-10"
    >
      <Card>
        <CardContent className="p-0">
          <ul className="divide-border/60 divide-y">
            {SAMPLE_HISTORY.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 px-5 py-3">
                <span className="bg-surface-muted text-muted-foreground mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <HistoryKindIcon kind={entry.kind} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{entry.label}</p>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {formatRelativeTime(entry.createdAt)}
                  </p>
                </div>
                <Badge variant="neutral" className="mt-0.5 shrink-0">
                  {KIND_LABEL[entry.kind]}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </Section>
  );
}
