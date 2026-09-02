import {
  formatDate,
  formatRelativeTime,
  type PaginatedResult,
  type UserProfile,
} from '@edt/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminSearchBar } from '@/components/admin/admin-search-bar';
import { AdminUserActions } from '@/components/admin/admin-user-actions';
import { RequireAuthNotice } from '@/components/data/require-auth-notice';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api/client';

export const metadata: Metadata = {
  title: 'Admin · Users',
  description: 'Accounts, roles, plans and suspensions.',
};

// Reads admin-only, per-request account data from the gateway.
export const dynamic = 'force-dynamic';

type AdminUser = UserProfile & { status: string; suspendedAt: string | null };

interface UsersSearchParams {
  page?: string;
  q?: string;
  role?: string;
  plan?: string;
  status?: string;
}

const STATUS_VARIANT: Record<string, 'success' | 'danger' | 'warning' | 'neutral'> = {
  active: 'success',
  suspended: 'danger',
  unverified: 'warning',
};

const ROLE_VARIANT: Record<string, 'primary' | 'secondary' | 'neutral'> = {
  owner: 'primary',
  admin: 'primary',
  analyst: 'secondary',
  user: 'neutral',
};

async function loadUsers(
  searchParams: UsersSearchParams,
): Promise<{ ok: true; result: PaginatedResult<AdminUser> } | { ok: false; forbidden: boolean }> {
  const page = Number.parseInt(searchParams.page ?? '1', 10) || 1;
  try {
    const result = await api<PaginatedResult<AdminUser>>('/admin/users', {
      query: {
        page,
        pageSize: 20,
        q: searchParams.q,
        role: searchParams.role,
        plan: searchParams.plan,
        status: searchParams.status,
      },
    });
    return { ok: true, result };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return { ok: false, forbidden: error.status === 403 };
    }
    return { ok: false, forbidden: false };
  }
}

export default function AdminUsersPage({ searchParams }: { searchParams: UsersSearchParams }) {
  return (
    <>
      <PageHeader
        eyebrow={<Badge variant="primary">Administration</Badge>}
        title="Users"
        description="Accounts, roles, plans and suspensions."
        actions={<AdminSearchBar placeholder="Search email, name or organisation…" />}
      />

      <Suspense fallback={<UsersSkeleton />}>
        <UsersView searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function UsersView({ searchParams }: { searchParams: UsersSearchParams }) {
  const outcome = await loadUsers(searchParams);

  if (!outcome.ok) {
    return (
      <RequireAuthNotice
        title={outcome.forbidden ? 'Forbidden' : 'Sign in required'}
        description={
          outcome.forbidden
            ? 'Your account does not have permission to view user accounts.'
            : 'Sign in with an admin account to see user accounts.'
        }
      />
    );
  }

  const { result } = outcome;

  if (result.items.length === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="display-tight text-base">No users match this search</p>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
          Try a different search term or clear the filters.
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-border/60 border-b text-left text-xs">
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-3 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Role</th>
                <th className="px-3 py-3 font-medium">Plan</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Joined</th>
                <th className="px-3 py-3 font-medium">Last login</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-border/60 divide-y">
              {result.items.map((user) => (
                <tr key={user.id}>
                  <td className="px-5 py-2.5 font-medium">{user.email}</td>
                  <td className="text-muted-foreground truncate px-3 py-2.5">{user.name}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={ROLE_VARIANT[user.role] ?? 'neutral'} className="capitalize">
                      {user.role}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className="capitalize">
                      {user.plan}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge
                      variant={STATUS_VARIANT[user.status] ?? 'neutral'}
                      className="capitalize"
                    >
                      {user.status}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground px-3 py-2.5">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="text-muted-foreground px-3 py-2.5">
                    {user.lastLoginAt ? formatRelativeTime(user.lastLoginAt) : 'Never'}
                  </td>
                  <td className="px-5 py-2.5">
                    <AdminUserActions
                      userId={user.id}
                      role={user.role}
                      plan={user.plan}
                      suspended={user.status === 'suspended'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          Page {result.page} of {result.totalPages} · {result.total} users
        </p>
        <AdminPagination
          page={result.page}
          hasNext={result.hasNext}
          hasPrevious={result.hasPrevious}
        />
      </div>
    </>
  );
}

function UsersSkeleton() {
  return (
    <Card className="p-5">
      <Skeleton className="h-5 w-40" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 10 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-full" />
        ))}
      </div>
    </Card>
  );
}
