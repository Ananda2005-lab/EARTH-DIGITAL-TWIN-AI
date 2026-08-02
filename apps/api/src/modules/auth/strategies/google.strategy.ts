import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile, type StrategyOptions } from 'passport-google-oauth20';
import type { AppConfig } from 'src/config/configuration';
import type { OAuthProfileInput } from '../auth.service';

/**
 * Passport's own `VerifyCallback` is typed against `Express.User` (the fully
 * hydrated principal), but OAuth strategies hand back an unresolved profile that
 * AuthService exchanges for a user. Narrowing the callback keeps that honest.
 */
type GoogleVerifyCallback = (error: Error | null, user?: OAuthProfileInput) => void;

/**
 * Google OAuth 2.0. Registered only when credentials are configured, so a
 * deployment without Google keys still boots (see AuthModule.oauthProviders).
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService<AppConfig, true>) {
    const google = config.get('oauth', { infer: true }).google;
    const options: StrategyOptions = {
      clientID: google.clientId ?? 'not-configured',
      clientSecret: google.clientSecret ?? 'not-configured',
      callbackURL: google.callbackUrl ?? 'http://localhost:4000/api/v1/auth/google/callback',
      scope: ['email', 'profile'],
    };
    super(options);
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: GoogleVerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error('Google account did not expose an email address'));
      return;
    }
    const mapped: OAuthProfileInput = {
      provider: 'google',
      providerAccountId: profile.id,
      email: email.toLowerCase(),
      name: profile.displayName || email.split('@')[0] || 'Explorer',
      avatarUrl: profile.photos?.[0]?.value ?? null,
      displayName: profile.displayName ?? null,
    };
    done(null, mapped);
  }
}
