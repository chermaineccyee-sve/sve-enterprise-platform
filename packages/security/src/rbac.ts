/**
 * RBAC / session model contracts. Contract only — no implementation.
 *
 * Replaces SVEGIP's current free-text role string + JSONB permission-string
 * array (functional today, but not table-driven — see
 * SVEGIP_ENTERPRISE_ASSESSMENT.md §AE) with canonical, typed shapes. Not
 * applied to apps/svegip by this PR.
 */
import type { EntityContext } from "@sve/types/entity-context";

export interface Role {
  id: string;
  name: string; // canonical, e.g. "Administrator" — not free text per-caller
  description?: string;
}

export interface Permission {
  id: string;
  key: string; // canonical, e.g. "accounts.manage", "vault.admin"
  description?: string;
}

/**
 * The authenticated identity + authorization state an API request carries.
 * A future core composition root builds this once per request; domain
 * services receive it rather than re-deriving authorization from a raw
 * cookie/token themselves.
 */
export interface SessionContext {
  sessionId: string;
  userId: string;
  email: string;
  roles: Role[];
  permissions: Permission[];
  entityContext: EntityContext;
  mfaVerified: boolean;
  issuedAt: string; // ISO 8601
  expiresAt: string; // ISO 8601
}

/**
 * A sensitive action that requires re-verifying MFA even on an already
 * authenticated session — e.g. payroll approval, salary amendment, MFA
 * reset, privileged Data Vault access. See
 * docs/architecture/security-architecture.md "Step-up authentication".
 */
export interface StepUpRequirement {
  action: string; // e.g. "payroll.approve", "employee.bank_details.change"
  reason: string;
}

/**
 * Authorization check contract — implementations decide using the session's
 * roles/permissions AND its entityContext; a permission alone is never
 * sufficient without also checking entity scope (see
 * security-architecture.md "Entity-level access").
 */
export interface PermissionChecker {
  can(session: SessionContext, permissionKey: string, target?: EntityContext): boolean;
  requiresStepUp(action: string): StepUpRequirement | null;
}
