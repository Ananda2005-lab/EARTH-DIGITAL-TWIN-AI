import { Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { AppConfig } from 'src/config/configuration';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { TokenService } from './token.service';
import { GithubStrategy } from './strategies/github.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * OAuth strategies are only registered when their credentials exist. Passport
 * throws at construction time on missing client ids, so conditional providers
 * keep a partially configured deployment bootable.
 */
function oauthProviders(): Provider[] {
  const providers: Provider[] = [];
  providers.push({
    provide: GoogleStrategy,
    inject: [ConfigService],
    useFactory: (config: ConfigService<AppConfig, true>) =>
      config.get('oauth', { infer: true }).google.enabled ? new GoogleStrategy(config) : null,
  });
  providers.push({
    provide: GithubStrategy,
    inject: [ConfigService],
    useFactory: (config: ConfigService<AppConfig, true>) =>
      config.get('oauth', { infer: true }).github.enabled ? new GithubStrategy(config) : null,
  });
  return providers;
}

@Module({
  imports: [PassportModule.register({ session: false }), JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, TokenService, MfaService, JwtStrategy, ...oauthProviders()],
  exports: [AuthService, TokenService, MfaService],
})
export class AuthModule {}
