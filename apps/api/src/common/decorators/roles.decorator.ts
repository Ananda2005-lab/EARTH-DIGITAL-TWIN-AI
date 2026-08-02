import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@edt/shared';

export const ROLES_KEY = 'edt:roles';

/**
 * Require one of the listed roles. The guard compares by rank, so `@Roles('analyst')`
 * also admits `admin` and `owner`.
 */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
