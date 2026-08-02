import { Injectable, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AppException } from '../errors/app-exception';
import type { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Default guard for the whole API. Routes opt out with `@Public()`, and requests
 * already authenticated by `ApiKeyGuard` are let through untouched.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    if (request.user?.kind === 'api-key') return true;

    return super.canActivate(context);
  }

  override handleRequest<TUser = AuthenticatedUser>(err: unknown, user: unknown): TUser {
    if (err instanceof Error) throw err;
    if (!user) throw AppException.unauthorised('A valid access token is required');
    return user as TUser;
  }
}
