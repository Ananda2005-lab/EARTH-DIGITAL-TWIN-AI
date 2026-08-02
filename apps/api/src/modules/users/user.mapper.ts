import type { OAuthAccount, User, UserPreference } from '@prisma/client';
import { DEFAULT_PREFERENCES, type AuthProvider, type UserPreferences, type UserProfile } from '@edt/shared';

export type UserWithRelations = User & {
  oauthAccounts?: Pick<OAuthAccount, 'provider'>[];
};

/** Public projection of a user. Never includes hashes, tokens or internal flags. */
export function toUserProfile(user: UserWithRelations): UserProfile {
  const providers: AuthProvider[] = [];
  if (user.passwordHash) providers.push('password');
  for (const account of user.oauthAccounts ?? []) {
    if (account.provider === 'google' || account.provider === 'github') providers.push(account.provider);
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
    plan: user.plan,
    organisation: user.organisation,
    jobTitle: user.jobTitle,
    locale: user.locale,
    timezone: user.timezone,
    emailVerified: user.emailVerified,
    mfaEnabled: user.mfaEnabled,
    providers,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
  };
}

/** Maps the preference row onto the shared contract, filling gaps with defaults. */
export function toUserPreferences(preference: UserPreference | null): UserPreferences {
  if (!preference) return { ...DEFAULT_PREFERENCES };
  return {
    theme: preference.theme,
    units: preference.units,
    temperatureUnit: preference.temperatureUnit,
    mapBasemap: preference.mapBasemap,
    defaultLayers: preference.defaultLayers,
    reducedMotion: preference.reducedMotion,
    highContrast: preference.highContrast,
    labelDensity: preference.labelDensity,
    autoRotateGlobe: preference.autoRotateGlobe,
    telemetryOptIn: preference.telemetryOptIn,
    emailDigest: preference.emailDigest,
    hazardAlertRadiusKm: preference.hazardAlertRadiusKm,
  };
}
