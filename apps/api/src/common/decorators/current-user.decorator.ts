import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AppException } from '../errors/app-exception';
import type { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Injects the authenticated principal. Use `@CurrentUser()` on guarded routes and
 * `@CurrentUser({ optional: true })` where anonymous access is allowed.
 */
export const CurrentUser = createParamDecorator(
  (options: { optional?: boolean } | undefined, context: ExecutionContext): AuthenticatedUser | undefined => {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;
    if (!user) {
      if (options?.optional) return undefined;
      throw AppException.unauthorised();
    }
    return user;
  },
);
