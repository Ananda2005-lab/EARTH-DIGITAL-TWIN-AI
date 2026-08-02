import type { SubscriptionPlan, UserRole } from '@edt/shared';

/** Principal attached to a request, either a human bearer token or an API key. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  plan: SubscriptionPlan;
  emailVerified: boolean;
  mfaEnabled: boolean;
  /** Set for interactive sessions created by the refresh-token family. */
  sessionId: string | null;
  /** Present when the principal authenticated with an API key. */
  apiKeyId: string | null;
  scopes: string[];
  kind: 'user' | 'api-key';
}

export interface AccessTokenPayload {
  /** Subject: the user id. */
  sub: string;
  email: string;
  role: UserRole;
  plan: SubscriptionPlan;
  /** Session (refresh-token family) this access token belongs to. */
  sid: string | null;
  /** JWT id, used for targeted revocation lists. */
  jti: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}
