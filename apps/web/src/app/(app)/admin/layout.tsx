import type * as React from 'react';

import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { PageContainer } from '@/components/layout/page-header';

/**
 * Nested chrome for every `/admin/*` route: a secondary rail on the left for
 * jumping between admin sections, main content to the right. Sits inside the
 * primary `AppShell`, which already provides the top bar and outer scroll.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-[calc(100dvh-3.5rem)]">
      <AdminSidebar />
      <div className="min-w-0 flex-1">
        <PageContainer>{children}</PageContainer>
      </div>
    </div>
  );
}
