import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiExcludeEndpoint,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { AuthSession, UserProfile } from '@edt/shared';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { RawResponse } from 'src/common/decorators/raw-response.decorator';
import { Audit } from 'src/common/decorators/audit.decorator';
import { AppException } from 'src/common/errors/app-exception';
import type { AuthenticatedUser } from 'src/common/types/authenticated-user';
import type { AppConfig } from 'src/config/configuration';
import { AuthService, type OAuthProfileInput } from './auth.service';
import { MfaService, type MfaEnrolment } from './mfa.service';
import type { SessionSummary } from './token.service';
import { parseDuration } from './token.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  MfaCodeDto,
  RefreshDto,
  RegisterDto,
  ResendVerificationDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto';

const REFRESH_COOKIE = 'edt_refresh';
const ACCESS_COOKIE = 'edt_access';

/** Tight limits on credential endpoints: 10 attempts per 5 minutes per client. */
const CREDENTIAL_THROTTLE = { default: { limit: 10, ttl: 300_000 } };
/** Even tighter for the endpoints that send email or mutate a password. */
const RECOVERY_THROTTLE = { default: { limit: 5, ttl: 900_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly mfa: MfaService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  @Post('register')
  @Public()
  @Throttle(CREDENTIAL_THROTTLE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create an account',
    description: 'Registers a user, emails a verification link and returns a signed-in session.',
  })
  @ApiBody({ schema: RegisterDto.openApiSchema })
  @ApiCreatedResponse({ description: 'Account created and session issued' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  @ApiResponse({ status: 422, description: 'Validation failed' })
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    const session = await this.auth.register(dto, this.contextOf(request));
    this.setRefreshCookie(response, session.tokens.refreshToken);
    this.setAccessCookie(response, session.tokens.accessToken);
    return session;
  }

  @Post('login')
  @Public()
  @Throttle(CREDENTIAL_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in with email and password',
    description: 'Requires `mfaCode` when MFA is enabled.',
  })
  @ApiBody({ schema: LoginDto.openApiSchema })
  @ApiOkResponse({ description: 'Session issued' })
  @ApiResponse({ status: 401, description: 'Bad credentials or missing/invalid MFA code' })
  @ApiResponse({ status: 403, description: 'Account suspended or temporarily locked' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    const session = await this.auth.login(dto, this.contextOf(request));
    this.setRefreshCookie(response, session.tokens.refreshToken);
    this.setAccessCookie(response, session.tokens.accessToken);
    return session;
  }

  @Post('refresh')
  @Public()
  @Throttle({ default: { limit: 60, ttl: 300_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate the refresh token',
    description:
      'Consumes the presented refresh token and returns a new pair. Replaying a consumed token revokes the whole token family.',
  })
  @ApiBody({ schema: RefreshDto.openApiSchema, required: false })
  @ApiOkResponse({ description: 'New token pair issued' })
  @ApiResponse({ status: 401, description: 'Token unknown, expired or already used' })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    const token = dto.refreshToken ?? this.readRefreshCookie(request);
    if (!token) throw AppException.unauthorised('No refresh token supplied');
    const session = await this.auth.refresh(token, this.contextOf(request));
    this.setRefreshCookie(response, session.tokens.refreshToken);
    this.setAccessCookie(response, session.tokens.accessToken);
    return session;
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Sign out',
    description: 'Revokes the presented refresh token family and clears the cookie.',
  })
  @ApiResponse({ status: 204, description: 'Signed out' })
  async logout(
    @Body() dto: RefreshDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = dto.refreshToken ?? this.readRefreshCookie(request);
    await this.auth.logout(token, request.user?.id ?? null, this.contextOf(request));
    response.clearCookie(REFRESH_COOKIE, { path: '/' });
    this.clearAccessCookie(response);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Current principal',
    description: 'Resolved from the bearer token on every request.',
  })
  @ApiOkResponse({ description: 'The authenticated principal' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  @Post('verify-email')
  @Public()
  @Throttle(RECOVERY_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm an email address' })
  @ApiBody({ schema: VerifyEmailDto.openApiSchema })
  @ApiOkResponse({ description: 'Email verified' })
  @ApiResponse({ status: 400, description: 'Link invalid or expired' })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<UserProfile> {
    return this.auth.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  @Public()
  @Throttle(RECOVERY_THROTTLE)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Resend the verification email',
    description:
      'Always succeeds, so the endpoint cannot be used to discover registered addresses.',
  })
  @ApiBody({ schema: ResendVerificationDto.openApiSchema })
  @ApiResponse({ status: 202, description: 'Accepted' })
  async resendVerification(@Body() dto: ResendVerificationDto): Promise<{ accepted: true }> {
    await this.auth.resendVerification(dto.email);
    return { accepted: true };
  }

  @Post('forgot-password')
  @Public()
  @Throttle(RECOVERY_THROTTLE)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Request a password reset link',
    description: 'Always reports success.',
  })
  @ApiBody({ schema: ForgotPasswordDto.openApiSchema })
  @ApiResponse({ status: 202, description: 'Accepted' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() request: Request,
  ): Promise<{ accepted: true }> {
    await this.auth.forgotPassword(dto.email, this.contextOf(request));
    return { accepted: true };
  }

  @Post('reset-password')
  @Public()
  @Throttle(RECOVERY_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set a new password with a reset token',
    description: 'Revokes every existing session.',
  })
  @ApiBody({ schema: ResetPasswordDto.openApiSchema })
  @ApiOkResponse({ description: 'Password updated' })
  @ApiResponse({ status: 400, description: 'Token invalid or expired' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() request: Request,
  ): Promise<{ updated: true }> {
    await this.auth.resetPassword(dto.token, dto.password, this.contextOf(request));
    return { updated: true };
  }

  @Post('change-password')
  @ApiBearerAuth()
  @Throttle(RECOVERY_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: 'auth.password_change',
    resource: 'user',
    redact: ['currentPassword', 'password', 'confirmPassword'],
  })
  @ApiOperation({ summary: 'Change your password', description: 'Signs out every other session.' })
  @ApiBody({ schema: ChangePasswordDto.openApiSchema })
  @ApiOkResponse({ description: 'Password updated' })
  @ApiResponse({ status: 401, description: 'Current password incorrect' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() request: Request,
  ): Promise<{ updated: true }> {
    await this.auth.changePassword(
      user.id,
      dto.currentPassword,
      dto.password,
      user.sessionId,
      this.contextOf(request),
    );
    return { updated: true };
  }

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List active sessions',
    description: 'Devices currently holding a valid refresh token.',
  })
  @ApiOkResponse({ description: 'Active sessions' })
  async sessions(@CurrentUser() user: AuthenticatedUser): Promise<SessionSummary[]> {
    return this.auth.listSessions(user.id, user.sessionId);
  }

  @Delete('sessions/:sessionId')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: 'auth.session_revoke', resource: 'session', idParam: 'sessionId' })
  @ApiOperation({ summary: 'Revoke one session' })
  @ApiParam({ name: 'sessionId', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Session revoked' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
  ): Promise<void> {
    await this.auth.revokeSession(user.id, sessionId);
  }

  @Delete('sessions')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Revoke every other session',
    description: 'Keeps the caller signed in.',
  })
  @ApiOkResponse({ description: 'Number of revoked token families' })
  async revokeOtherSessions(@CurrentUser() user: AuthenticatedUser): Promise<{ revoked: number }> {
    return { revoked: await this.auth.revokeOtherSessions(user.id, user.sessionId) };
  }

  @Post('mfa/enable')
  @ApiBearerAuth()
  @Throttle(CREDENTIAL_THROTTLE)
  @Audit({ action: 'auth.mfa_enrol', resource: 'user' })
  @ApiOperation({
    summary: 'Begin TOTP enrolment',
    description:
      'Returns the secret, otpauth URI and one-time recovery codes. Confirm with POST /auth/mfa/verify.',
  })
  @ApiOkResponse({ description: 'Enrolment material' })
  @ApiResponse({ status: 409, description: 'MFA already enabled' })
  async enableMfa(@CurrentUser() user: AuthenticatedUser): Promise<MfaEnrolment> {
    return this.mfa.beginEnrolment(user.id, user.email);
  }

  @Post('mfa/verify')
  @ApiBearerAuth()
  @Throttle(CREDENTIAL_THROTTLE)
  @Audit({ action: 'auth.mfa_confirm', resource: 'user', redact: ['code'] })
  @ApiOperation({ summary: 'Confirm TOTP enrolment' })
  @ApiBody({ schema: MfaCodeDto.openApiSchema })
  @ApiOkResponse({ description: 'MFA enabled' })
  @ApiResponse({ status: 401, description: 'Invalid code' })
  async verifyMfa(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MfaCodeDto,
  ): Promise<{ enabled: true }> {
    await this.mfa.confirmEnrolment(user.id, dto.code);
    return { enabled: true };
  }

  @Post('mfa/disable')
  @ApiBearerAuth()
  @Throttle(CREDENTIAL_THROTTLE)
  @Audit({ action: 'auth.mfa_disable', resource: 'user', redact: ['code'] })
  @ApiOperation({
    summary: 'Disable MFA',
    description: 'Requires a current TOTP or recovery code.',
  })
  @ApiBody({ schema: MfaCodeDto.openApiSchema })
  @ApiOkResponse({ description: 'MFA disabled' })
  @ApiResponse({ status: 401, description: 'Invalid code' })
  async disableMfa(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MfaCodeDto,
  ): Promise<{ enabled: false }> {
    await this.mfa.disable(user.id, dto.code);
    return { enabled: false };
  }

  @Get('google')
  @Public()
  @RawResponse()
  @UseGuards(AuthGuard('google'))
  @ApiOperation({
    summary: 'Start Google OAuth',
    description: 'Redirects to Google. Browser-only endpoint.',
  })
  @ApiResponse({ status: 302, description: 'Redirect to Google' })
  googleStart(): void {
    // Passport issues the redirect.
  }

  @Get('google/callback')
  @Public()
  @RawResponse()
  @UseGuards(AuthGuard('google'))
  @ApiExcludeEndpoint()
  async googleCallback(@Req() request: Request, @Res() response: Response): Promise<void> {
    await this.completeOAuth(request, response);
  }

  @Get('github')
  @Public()
  @RawResponse()
  @UseGuards(AuthGuard('github'))
  @ApiOperation({
    summary: 'Start GitHub OAuth',
    description: 'Redirects to GitHub. Browser-only endpoint.',
  })
  @ApiResponse({ status: 302, description: 'Redirect to GitHub' })
  githubStart(): void {
    // Passport issues the redirect.
  }

  @Get('github/callback')
  @Public()
  @RawResponse()
  @UseGuards(AuthGuard('github'))
  @ApiExcludeEndpoint()
  async githubCallback(@Req() request: Request, @Res() response: Response): Promise<void> {
    await this.completeOAuth(request, response);
  }

  @Delete('providers/:provider')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: 'auth.provider_unlink', resource: 'oauth_account', idParam: 'provider' })
  @ApiOperation({ summary: 'Unlink a social provider' })
  @ApiParam({ name: 'provider', enum: ['google', 'github'] })
  @ApiResponse({ status: 204, description: 'Provider unlinked' })
  @ApiResponse({ status: 409, description: 'Cannot remove the only sign-in method' })
  async unlinkProvider(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provider') provider: string,
  ): Promise<void> {
    if (provider !== 'google' && provider !== 'github') {
      throw AppException.badRequest('Unknown provider');
    }
    await this.auth.unlinkProvider(user.id, provider);
  }

  private async completeOAuth(request: Request, response: Response): Promise<void> {
    const oauth = this.config.get('oauth', { infer: true });
    const profile = request.user as unknown as OAuthProfileInput | undefined;
    if (!profile?.provider) {
      response.redirect(oauth.failureRedirect);
      return;
    }
    try {
      const session = await this.auth.loginWithOAuth(profile, this.contextOf(request));
      this.setRefreshCookie(response, session.tokens.refreshToken);
      this.setAccessCookie(response, session.tokens.accessToken);
      const url = new URL(oauth.successRedirect);
      url.searchParams.set('access_token', session.tokens.accessToken);
      url.searchParams.set('expires_in', String(session.tokens.expiresIn));
      response.redirect(url.toString());
    } catch {
      response.redirect(oauth.failureRedirect);
    }
  }

  private contextOf(request: Request): { ip: string | null; userAgent: string | null } {
    return { ip: request.ip ?? null, userAgent: request.header('user-agent') ?? null };
  }

  private setRefreshCookie(response: Response, token: string): void {
    const jwt = this.config.get('jwt', { infer: true });
    response.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.config.get('isProduction', { infer: true }),
      sameSite: 'lax',
      path: '/',
      maxAge: jwt.refreshTtlDays * 86_400_000,
    });
  }

  /**
   * The browser-only flow (web app) authenticates through cookies, so the short-
   * lived access token is also mirrored into an HttpOnly cookie — the JWT
   * strategy already reads it (see strategies/jwt.strategy.ts). Clearing it on
   * logout keeps `/auth/me` honest even if the refresh cookie somehow survives.
   */
  private setAccessCookie(response: Response, token: string): void {
    const seconds = parseDuration(this.config.get('jwt', { infer: true }).accessTtl);
    response.cookie(ACCESS_COOKIE, token, {
      httpOnly: true,
      secure: this.config.get('isProduction', { infer: true }),
      sameSite: 'lax',
      path: '/',
      maxAge: seconds * 1000,
    });
  }

  private clearAccessCookie(response: Response): void {
    response.clearCookie(ACCESS_COOKIE, { path: '/' });
  }

  private readRefreshCookie(request: Request): string | undefined {
    const cookies = (request as unknown as { cookies?: Record<string, string> }).cookies;
    return cookies?.[REFRESH_COOKIE];
  }
}
