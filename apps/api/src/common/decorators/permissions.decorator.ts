import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@edt/shared';

export const PERMISSIONS_KEY = 'edt:permissions';

/**
 * Require every listed capability. Capabilities are resolved with
 * `hasPermission()` from `@edt/shared`, keeping the matrix in one place.
 */
export const RequirePermission = (...permissions: Permission[]): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_KEY, permissions);
