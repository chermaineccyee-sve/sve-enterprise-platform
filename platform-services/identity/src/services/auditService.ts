/**
 * Thin wrapper over AuditRepository that is the single place every audit
 * write goes through, so redaction is enforced structurally rather than by
 * every call site remembering to be careful. See docs/architecture/
 * identity-foundation.md "Security audit" and item 12 of the PR brief for
 * the exact event list.
 */
import type { AuditRepository } from "../repositories/types.ts";

const FORBIDDEN_KEYS = ["password", "token", "secret", "recoveryCode", "code_hash", "codeHash", "totpSecret"];

function redact(value: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!value) return null;
  const clean: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.some((f) => key.toLowerCase().includes(f.toLowerCase()))) continue;
    clean[key] = v;
  }
  return clean;
}

export type IdentitySecurityAction =
  | "auth.login.success"
  | "auth.login.failure"
  | "auth.login.throttled"
  | "auth.logout"
  | "session.created"
  | "session.revoked"
  | "session.revoked_all"
  | "mfa.enrolment_started"
  | "mfa.enrolment_verified"
  | "mfa.challenge_verified"
  | "mfa.challenge_failed"
  | "mfa.disabled"
  | "mfa.recovery_code_used"
  | "mfa.recovery_codes_regenerated"
  | "rbac.role_assigned"
  | "rbac.role_revoked"
  | "rbac.entity_access_granted"
  | "rbac.entity_access_revoked"
  | "account.disabled"
  | "account.enabled"
  | "credential.changed"
  | "data_vault.record.created"
  | "data_vault.record.viewed"
  | "data_vault.record.updated"
  | "data_vault.record.classification_changed"
  | "data_vault.record.entity_changed"
  | "data_vault.record.archived"
  | "data_vault.access.denied";

export function createAuditService(deps: { audit: AuditRepository }) {
  return {
    async record(input: {
      actorUserId: string | null;
      actorEmail: string | null;
      action: IdentitySecurityAction;
      resourceType: string;
      resourceId?: string | null;
      legalEntityId?: string | null;
      sessionId?: string | null;
      changeBefore?: Record<string, unknown>;
      changeAfter?: Record<string, unknown>;
      sourceIp?: string | null;
      sourceUserAgent?: string | null;
    }) {
      return deps.audit.record({
        actorUserId: input.actorUserId,
        actorEmail: input.actorEmail,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        legalEntityId: input.legalEntityId ?? null,
        sessionId: input.sessionId ?? null,
        changeBefore: redact(input.changeBefore),
        changeAfter: redact(input.changeAfter),
        sourceIp: input.sourceIp ?? null,
        sourceUserAgent: input.sourceUserAgent ?? null,
      });
    },
  };
}

export type AuditService = ReturnType<typeof createAuditService>;
