import {
  formatRelativeTime,
  type PaginatedResult,
  type Report,
  type ReportStatus,
} from '@edt/shared';
import { Download } from 'lucide-react';
import type { Metadata } from 'next';

import { RequireAuthNotice } from '@/components/data/require-auth-notice';
import { PageContainer, PageHeader, Section } from '@/components/layout/page-header';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api/client';

import { NewReportDialog } from './new-report-dialog';
import { REPORT_KIND_LABEL, ReportStatusBadge } from './report-status-badge';

export const metadata: Metadata = {
  title: 'Reports',
  description:
    'Generate, schedule and export intelligence briefs — AI-generated country, city and area reports, tracked from queued to ready.',
};

interface SampleReport {
  id: string;
  title: string;
  kind: string;
  status: ReportStatus;
  createdAt: string;
}

const STATUS_BADGE_VARIANT: Record<ReportStatus, NonNullable<BadgeProps['variant']>> = {
  queued: 'neutral',
  generating: 'warning',
  ready: 'primary',
  failed: 'danger',
};

const STATUS_LABEL: Record<ReportStatus, string> = {
  queued: 'Queued',
  generating: 'Generating',
  ready: 'Ready',
  failed: 'Failed',
};

const SAMPLE_REPORTS: SampleReport[] = [
  {
    id: 'sample-1',
    title: 'Japan — Country Profile',
    kind: 'Country profile',
    status: 'ready',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sample-2',
    title: 'Jakarta Flood Risk — Environmental Risk',
    kind: 'Environmental risk',
    status: 'generating',
    createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  },
  {
    id: 'sample-3',
    title: 'Peru vs. Bolivia — Comparison',
    kind: 'Comparison',
    status: 'queued',
    createdAt: new Date(Date.now() - 60 * 1000).toISOString(),
  },
  {
    id: 'sample-4',
    title: 'Iceland Two-Week Trip — Travel Plan',
    kind: 'Travel plan',
    status: 'failed',
    createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
  },
];

// Reads the signed-in user's reports, which is per-request data.
export const dynamic = 'force-dynamic';

async function loadReports(): Promise<PaginatedResult<Report> | null> {
  try {
    return await api<PaginatedResult<Report>>('/reports', { query: { pageSize: 60 } });
  } catch {
    return null;
  }
}

export default async function ReportsPage() {
  const reports = await loadReports();

  return (
    <PageContainer>
      <PageHeader
        eyebrow={reports ? <Badge variant="primary">{reports.total} reports</Badge> : undefined}
        title="Reports"
        description="Request an AI-generated brief on a country, city or area and track it through to completion."
        actions={reports ? <NewReportDialog /> : undefined}
      />

      {!reports ? (
        <RequireAuthNotice description="Sign in to generate reports." />
      ) : reports.items.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="display-tight text-base">No reports yet</p>
          <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
            Generate a country profile, area summary or comparison and it will appear here while it
            is being written.
          </p>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-border/60 divide-y">
              {reports.items.map((report) => (
                <ReportRow key={report.id} report={report} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <ReportsPreviewSection />
    </PageContainer>
  );
}

function ReportRow({ report }: { report: Report }) {
  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{report.title}</p>
        <p className="text-muted-foreground mt-0.5 truncate text-xs">
          {REPORT_KIND_LABEL[report.kind]} · {formatRelativeTime(report.createdAt)}
          {report.summary ? ` · ${report.summary}` : ''}
        </p>
      </div>
      <ReportStatusBadge status={report.status} className="mt-0.5 shrink-0" />
    </li>
  );
}

/**
 * Sample-data walkthrough of the finished feature. Rendered unconditionally
 * (signed in or not) so reviewers can see the intended UI without a live
 * session — none of this data is fetched.
 */
function ReportsPreviewSection() {
  return (
    <Section
      title="What this looks like"
      description="Sample reports showing the states a real brief moves through, from queued to ready."
      actions={<Badge variant="secondary">Preview</Badge>}
      className="mt-10"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SAMPLE_REPORTS.map((report) => (
          <Card key={report.id} className="flex h-full flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm">{report.title}</CardTitle>
                <Badge variant={STATUS_BADGE_VARIANT[report.status]} className="shrink-0">
                  {report.status === 'generating' ? (
                    <span className="live-dot" aria-hidden />
                  ) : null}
                  {STATUS_LABEL[report.status]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 pt-0">
              <p className="text-muted-foreground text-xs">
                {report.kind} · generated {formatRelativeTime(report.createdAt)}
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm" className="w-full" disabled>
                <Download />
                Download PDF
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </Section>
  );
}
