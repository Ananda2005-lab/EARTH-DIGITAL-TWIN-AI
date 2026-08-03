import { formatRelativeTime, type PaginatedResult, type Workspace } from '@edt/shared';
import { Globe2, Layers, Lock, Users } from 'lucide-react';
import type { Metadata } from 'next';

import { RequireAuthNotice } from '@/components/data/require-auth-notice';
import { PageContainer, PageHeader, Section } from '@/components/layout/page-header';
import { Avatar, AvatarFallback, initialsOf } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api/client';

import { NewWorkspaceDialog } from './new-workspace-dialog';

export const metadata: Metadata = {
  title: 'Workspaces',
  description:
    'Collaborative scenes with annotations and shared layers — saved globe views with collaborators.',
};

// Reads the signed-in user's workspaces, which is per-request data.
export const dynamic = 'force-dynamic';

const VISIBILITY_LABEL = { private: 'Private', team: 'Team', public: 'Public' } as const;
const VISIBILITY_ICON = { private: Lock, team: Users, public: Globe2 } as const;

interface SampleWorkspace {
  id: string;
  name: string;
  description: string;
  visibility: keyof typeof VISIBILITY_LABEL;
  layerCount: number;
  collaborators: string[];
  updatedAt: string;
}

const SAMPLE_WORKSPACES: SampleWorkspace[] = [
  {
    id: 'sample-1',
    name: 'Pacific storm tracking',
    description: 'Cyclone tracks, sea surface temperature and shipping lanes for the West Pacific.',
    visibility: 'team',
    layerCount: 6,
    collaborators: ['Amara Okafor', 'Priya Nair', 'Liam Chen'],
    updatedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: 'sample-2',
    name: 'East Africa drought watch',
    description: 'Precipitation anomalies, soil moisture and affected population overlays.',
    visibility: 'public',
    layerCount: 4,
    collaborators: ['Diego Fernández'],
    updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sample-3',
    name: 'Q3 flight delay review',
    description: 'ADS-B congestion, weather overlays and airport boards for the busiest hubs.',
    visibility: 'private',
    layerCount: 3,
    collaborators: ['Sofia Rossi', 'Kenji Watanabe'],
    updatedAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
  },
];

async function loadWorkspaces(): Promise<PaginatedResult<Workspace> | null> {
  try {
    return await api<PaginatedResult<Workspace>>('/workspaces', { query: { pageSize: 60 } });
  } catch {
    return null;
  }
}

export default async function WorkspacePage() {
  const workspaces = await loadWorkspaces();

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          workspaces ? <Badge variant="primary">{workspaces.total} workspaces</Badge> : undefined
        }
        title="Workspaces"
        description="Saved globe scenes with a view, active layers, annotations and anyone you have invited."
        actions={workspaces ? <NewWorkspaceDialog /> : undefined}
      />

      {!workspaces ? (
        <RequireAuthNotice description="Sign in to create a workspace." />
      ) : workspaces.items.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="display-tight text-base">No workspaces yet</p>
          <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
            Save the globe&apos;s current view, layers and annotations as a workspace to return to
            it later or share it with your team.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {workspaces.items.map((workspace) => (
            <WorkspaceTile key={workspace.id} workspace={workspace} />
          ))}
        </div>
      )}

      <WorkspacePreviewSection />
    </PageContainer>
  );
}

function WorkspaceTile({ workspace }: { workspace: Workspace }) {
  const VisibilityIcon = VISIBILITY_ICON[workspace.visibility];
  return (
    <Card className="h-full p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-sm font-medium">{workspace.name}</p>
        <Badge variant="neutral" className="shrink-0">
          <VisibilityIcon className="size-3" aria-hidden />
          {VISIBILITY_LABEL[workspace.visibility]}
        </Badge>
      </div>
      <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
        {workspace.description ?? 'No description'}
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="stat-label">Layers</dt>
          <dd className="numeric mt-0.5 text-sm">{workspace.layers.length}</dd>
        </div>
        <div>
          <dt className="stat-label">Updated</dt>
          <dd className="mt-0.5 text-sm">{formatRelativeTime(workspace.updatedAt)}</dd>
        </div>
      </dl>
    </Card>
  );
}

/**
 * Sample-data walkthrough of the finished feature. Rendered unconditionally
 * (signed in or not) so reviewers can see the intended UI without a live
 * session — none of this data is fetched.
 */
function WorkspacePreviewSection() {
  return (
    <Section
      title="What this looks like"
      description="Sample workspaces showing collaborators, layer counts and last-edited times."
      actions={<Badge variant="secondary">Preview</Badge>}
      className="mt-10"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SAMPLE_WORKSPACES.map((workspace) => {
          const VisibilityIcon = VISIBILITY_ICON[workspace.visibility];
          return (
            <Card key={workspace.id} className="h-full p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-sm font-medium">{workspace.name}</p>
                <Badge variant="neutral" className="shrink-0">
                  <VisibilityIcon className="size-3" aria-hidden />
                  {VISIBILITY_LABEL[workspace.visibility]}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
                {workspace.description}
              </p>

              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="flex -space-x-2">
                  {workspace.collaborators.slice(0, 3).map((name) => (
                    <Avatar key={name} className="ring-surface size-7 ring-2">
                      <AvatarFallback className="text-2xs">{initialsOf(name)}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <Badge variant="neutral">
                  <Layers className="size-3" aria-hidden />
                  {workspace.layerCount}
                </Badge>
              </div>

              <p className="text-muted-foreground mt-3 text-xs">
                Updated {formatRelativeTime(workspace.updatedAt)}
              </p>
            </Card>
          );
        })}
      </div>
    </Section>
  );
}
