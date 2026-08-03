import { formatDate, formatRelativeTime, type UserProfile } from '@edt/shared';
import type { Metadata } from 'next';

import { RequireAuthNotice } from '@/components/data/require-auth-notice';
import { Avatar, AvatarFallback, AvatarImage, initialsOf } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageContainer, PageHeader, Section } from '@/components/layout/page-header';
import { api } from '@/lib/api/client';

import { EditProfileForm } from './edit-profile-form';
import type { SessionSummary } from './sessions-section';
import { SessionsSection } from './sessions-section';

export const metadata: Metadata = {
  title: 'Profile',
  description: 'Your account details, contact info and active sessions.',
};

// Reads the signed-in user's profile and sessions, which is per-request data.
export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<UserProfile['role'], string> = {
  user: 'Member',
  analyst: 'Analyst',
  admin: 'Admin',
  owner: 'Owner',
};

const PLAN_LABEL: Record<UserProfile['plan'], string> = {
  free: 'Free',
  pro: 'Pro',
  team: 'Team',
  enterprise: 'Enterprise',
};

interface ProfileData {
  profile: UserProfile;
  sessions: SessionSummary[];
}

async function loadProfile(): Promise<ProfileData | null> {
  try {
    const [profile, sessions] = await Promise.all([
      api<UserProfile>('/users/me'),
      api<SessionSummary[]>('/auth/sessions'),
    ]);
    return { profile, sessions };
  } catch {
    return null;
  }
}

export default async function ProfilePage() {
  const data = await loadProfile();

  return (
    <PageContainer>
      <PageHeader
        title="Profile"
        description="Your account details, contact info and active sessions."
      />

      {!data ? (
        <RequireAuthNotice description="Sign in to see and manage your profile." />
      ) : (
        <>
          <Card className="mb-8 p-6">
            <div className="flex flex-wrap items-start gap-4">
              <Avatar className="size-16">
                <AvatarImage src={data.profile.avatarUrl ?? undefined} alt={data.profile.name} />
                <AvatarFallback className="text-base">
                  {initialsOf(data.profile.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="display-tight text-lg">{data.profile.name}</h2>
                  <Badge variant="primary">{ROLE_LABEL[data.profile.role]}</Badge>
                  <Badge variant="secondary">{PLAN_LABEL[data.profile.plan]}</Badge>
                </div>
                <p className="text-muted-foreground mt-1 text-sm">{data.profile.email}</p>
                <dl className="text-muted-foreground mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                  {data.profile.organisation ? (
                    <div>
                      <dt className="inline">Organisation: </dt>
                      <dd className="text-foreground inline">{data.profile.organisation}</dd>
                    </div>
                  ) : null}
                  {data.profile.jobTitle ? (
                    <div>
                      <dt className="inline">Job title: </dt>
                      <dd className="text-foreground inline">{data.profile.jobTitle}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="inline">Member since: </dt>
                    <dd className="text-foreground inline">{formatDate(data.profile.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="inline">Last login: </dt>
                    <dd className="text-foreground inline">
                      {data.profile.lastLoginAt
                        ? formatRelativeTime(data.profile.lastLoginAt)
                        : 'Never'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </Card>

          <Section title="Edit profile" description="Name, organisation and job title.">
            <EditProfileForm profile={data.profile} />
          </Section>

          <Section
            title="Security"
            description="Devices and browsers currently signed in to your account."
          >
            <SessionsSection initialSessions={data.sessions} />
          </Section>
        </>
      )}
    </PageContainer>
  );
}
