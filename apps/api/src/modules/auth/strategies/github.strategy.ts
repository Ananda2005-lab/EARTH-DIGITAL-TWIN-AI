import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile, type StrategyOptions } from 'passport-github2';
import type { AppConfig } from 'src/config/configuration';
import type { OAuthProfileInput } from '../auth.service';

type GithubVerifyCallback = (error: Error | null, user?: OAuthProfileInput) => void;

/** GitHub OAuth. Requires the `user:email` scope to obtain a usable address. */
@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(config: ConfigService<AppConfig, true>) {
    const github = config.get('oauth', { infer: true }).github;
    const options: StrategyOptions = {
      clientID: github.clientId ?? 'not-configured',
      clientSecret: github.clientSecret ?? 'not-configured',
      callbackURL: github.callbackUrl ?? 'http://localhost:4000/api/v1/auth/github/callback',
      scope: ['user:email'],
    };
    super(options);
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: GithubVerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error('GitHub account has no public or verified email address'));
      return;
    }
    done(null, {
      provider: 'github',
      providerAccountId: profile.id,
      email: email.toLowerCase(),
      name: profile.displayName || profile.username || email.split('@')[0] || 'Explorer',
      avatarUrl: profile.photos?.[0]?.value ?? null,
      displayName: profile.displayName ?? profile.username ?? null,
    });
  }
}
