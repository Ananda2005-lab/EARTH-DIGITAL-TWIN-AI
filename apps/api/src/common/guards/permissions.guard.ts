import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { hasPermission, type Permission } from '@edt/shared';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AppException } from '../errors/app-exception';

/**
 * Capability check driven by the `PERMISSIONS` matrix in `@edt/shared`.
 * API-key principals satisfy a permission when it is present in their scopes.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;
    if (!user) throw AppException.unauthorised();

    const missing = required.filter((permission) =>
      user.kind === 'api-key'
        ? !user.scopes.includes(permission) && !user.scopes.includes('*')
        : !hasPermission(user.role, permission),
    );

    if (missing.length > 0) {
      throw AppException.forbidden('Missing required permission', {
        missing,
        actualRole: user.role,
      });
    }
    return true;
  }
}
