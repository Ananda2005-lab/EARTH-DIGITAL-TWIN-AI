import { Injectable, type ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Observable } from 'rxjs';
import type { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Attaches the principal when a bearer token is present but never rejects the
 * request. Used by public data routes that personalise their response.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  override canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    if (context.getType() !== 'http') return true;
    return super.canActivate(context);
  }

  override handleRequest<TUser = AuthenticatedUser | undefined>(
    _err: unknown,
    user: unknown,
  ): TUser {
    return (user === false || user === null ? undefined : user) as TUser;
  }
}
