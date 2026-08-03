import { DEFAULT_PREFERENCES, type UserPreferences } from '@edt/shared';
import type { Metadata } from 'next';

import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { api } from '@/lib/api/client';

import { PreferencesForm } from './preferences-form';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Appearance, units, layers, privacy and notification preferences.',
};

// Reads the signed-in user's preferences, which is per-request data.
export const dynamic = 'force-dynamic';

interface PreferencesLoad {
  preferences: UserPreferences;
  signedIn: boolean;
}

async function loadPreferences(): Promise<PreferencesLoad> {
  try {
    const preferences = await api<UserPreferences>('/preferences');
    return { preferences, signedIn: true };
  } catch {
    // Settings previews even signed out, so this falls back to defaults
    // instead of the standard sign-in-required empty state.
    return { preferences: DEFAULT_PREFERENCES, signedIn: false };
  }
}

export default async function SettingsPage() {
  const { preferences, signedIn } = await loadPreferences();

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Appearance, units, map density, privacy and notification preferences."
      />
      <PreferencesForm initialPreferences={preferences} signedIn={signedIn} />
    </PageContainer>
  );
}
