import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'edt:audit';

export interface AuditOptions {
  action: string;
  resource: string;
  /** Route parameter holding the resource id, e.g. `id`. */
  idParam?: string;
  /** Body keys that must never be persisted in the audit trail. */
  redact?: string[];
}

/** Record a privileged action in the immutable audit trail. */
export const Audit = (options: AuditOptions): MethodDecorator => SetMetadata(AUDIT_KEY, options);
