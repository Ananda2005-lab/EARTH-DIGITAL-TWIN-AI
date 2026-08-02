import type { BBox, LngLat, ViewState } from './geo';

export type UserRole = 'user' | 'analyst' | 'admin' | 'owner';

export type AuthProvider = 'password' | 'google' | 'github';

export type SubscriptionPlan = 'free' | 'pro' | 'team' | 'enterprise';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: UserRole;
  plan: SubscriptionPlan;
  organisation: string | null;
  jobTitle: string | null;
  locale: string;
  timezone: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
  providers: AuthProvider[];
  createdAt: string;
  lastLoginAt: string | null;
}

export interface UserPreferences {
  theme: 'dark' | 'light' | 'system';
  units: 'metric' | 'imperial';
  temperatureUnit: 'celsius' | 'fahrenheit';
  mapBasemap: string;
  defaultLayers: string[];
  reducedMotion: boolean;
  highContrast: boolean;
  labelDensity: 'minimal' | 'balanced' | 'detailed';
  autoRotateGlobe: boolean;
  telemetryOptIn: boolean;
  emailDigest: 'off' | 'daily' | 'weekly';
  hazardAlertRadiusKm: number;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  units: 'metric',
  temperatureUnit: 'celsius',
  mapBasemap: 'satellite',
  defaultLayers: ['borders', 'labels'],
  reducedMotion: false,
  highContrast: false,
  labelDensity: 'balanced',
  autoRotateGlobe: true,
  telemetryOptIn: true,
  emailDigest: 'weekly',
  hazardAlertRadiusKm: 250,
};

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface AuthSession {
  user: UserProfile;
  tokens: AuthTokens;
}

export interface Bookmark {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  kind: 'place' | 'view' | 'area' | 'route';
  center: LngLat;
  view: ViewState | null;
  bbox: BBox | null;
  countryCode: string | null;
  tags: string[];
  color: string;
  collectionId: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BookmarkCollection {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  color: string;
  bookmarkCount: number;
  createdAt: string;
}

export interface HistoryEntry {
  id: string;
  userId: string;
  kind: 'search' | 'place' | 'report' | 'ai' | 'layer';
  label: string;
  detail: string | null;
  center: LngLat | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface Workspace {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  view: ViewState;
  layers: string[];
  annotations: Annotation[];
  members: WorkspaceMember[];
  visibility: 'private' | 'team' | 'public';
  updatedAt: string;
  createdAt: string;
}

export interface WorkspaceMember {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: 'viewer' | 'editor' | 'owner';
}

export interface Annotation {
  id: string;
  kind: 'marker' | 'line' | 'polygon' | 'circle' | 'text' | 'measure';
  label: string;
  color: string;
  coordinates: LngLat[];
  radiusM?: number;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string | null;
  kind: 'hazard' | 'report' | 'system' | 'ai' | 'billing' | 'security';
  severity: 'info' | 'success' | 'warning' | 'critical';
  title: string;
  body: string;
  actionUrl: string | null;
  read: boolean;
  createdAt: string;
}

export type ReportStatus = 'queued' | 'generating' | 'ready' | 'failed';

export type ReportKind =
  | 'country_profile'
  | 'city_profile'
  | 'area_summary'
  | 'environmental_risk'
  | 'climate_outlook'
  | 'comparison'
  | 'travel_plan'
  | 'custom';

export interface Report {
  id: string;
  userId: string;
  title: string;
  kind: ReportKind;
  status: ReportStatus;
  /** Markdown body produced by the AI service. */
  content: string | null;
  summary: string | null;
  target: Record<string, unknown>;
  sections: ReportSection[];
  tokensUsed: number | null;
  generationMs: number | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ReportSection {
  id: string;
  heading: string;
  body: string;
  charts?: ReportChart[];
}

export interface ReportChart {
  kind: 'line' | 'bar' | 'area' | 'radar' | 'pie';
  title: string;
  series: { name: string; points: { x: string | number; y: number }[] }[];
}
