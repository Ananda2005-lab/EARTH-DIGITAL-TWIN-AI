import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLE_RANK, atLeastRole, type UserRole } from '@edt/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AppException } from '../errors/app-exception';

/**
 * Rank-based RBAC: a route requiring `analyst` is also open to `admin`/`owner`.
 * API-key principals are rejected — privileged routes need a human identity.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;
    if (!user) throw AppException.unauthorised();

    const minimum = required.reduce<UserRole>(
      (lowest, role) => (ROLE_RANK[role] < ROLE_RANK[lowest] ? role : lowest),
      required[0] as UserRole,
    );

    if (!atLeastRole(user.role, minimum)) {
      throw AppException.forbidden(`Requires the ${minimum} role or higher`, {
        requiredRole: minimum,
        actualRole: user.role,
      });
    }
    return true;
  }
}
