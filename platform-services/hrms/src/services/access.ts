/**
 * Shared RBAC/classification helpers for every HRMS lifecycle service —
 * mirrors platform-services/organisation's employeeService.ts pattern
 * (two-tier ordinary/.privileged permission keys standing in for a
 * classification ceiling Identity's rbacService already enforces) rather
 * than inventing a new authorization mechanism. See docs/architecture/
 * hrms-employee-lifecycle.md "RBAC" and "Sensitive HR data".
 *
 * Reuses (never re-derives) platform-services/organisation's SK Lai &
 * Partners classification-ceiling logic — imported by source path, the
 * same cross-package dependency direction Organisation itself uses for
 * Identity's contracts.
 */
import type { RbacService } from "../../../identity/src/services/rbacService.ts";
import type { LegalEntity } from "../../../identity/src/domain/entities.ts";
import type { DataClassification } from "../../../../packages/types/src/entity-context.ts";
import { classificationCeilingForEntity, restrictedFieldClassificationCeiling } from "../../../organisation/src/services/entityClassification.ts";

export const PERMISSIONS = {
  READ: "hrms.lifecycle.read",
  READ_PRIVILEGED: "hrms.lifecycle.read.privileged",
  READ_TEAM: "hrms.lifecycle.read.team",
  READ_RESTRICTED: "hrms.lifecycle.read.restricted",
  READ_RESTRICTED_PRIVILEGED: "hrms.lifecycle.read.restricted.privileged",
  READ_DECISION: "hrms.lifecycle.read.decision",
  READ_DECISION_PRIVILEGED: "hrms.lifecycle.read.decision.privileged",
  CREATE: "hrms.lifecycle.create",
  CREATE_PRIVILEGED: "hrms.lifecycle.create.privileged",
  MANAGE_ONBOARDING: "hrms.lifecycle.manage_onboarding",
  MANAGE_ONBOARDING_PRIVILEGED: "hrms.lifecycle.manage_onboarding.privileged",
  MANAGE_PROBATION: "hrms.lifecycle.manage_probation",
  MANAGE_PROBATION_PRIVILEGED: "hrms.lifecycle.manage_probation.privileged",
  MANAGE_EMPLOYMENT_CHANGE: "hrms.lifecycle.manage_employment_change",
  MANAGE_EMPLOYMENT_CHANGE_PRIVILEGED: "hrms.lifecycle.manage_employment_change.privileged",
  MANAGE_OFFBOARDING: "hrms.lifecycle.manage_offboarding",
  MANAGE_OFFBOARDING_PRIVILEGED: "hrms.lifecycle.manage_offboarding.privileged",
  /** Covers both completing AND cancelling a case — both are terminal, case-closing actions; a separate key added no real distinction. */
  COMPLETE: "hrms.lifecycle.complete",
  COMPLETE_PRIVILEGED: "hrms.lifecycle.complete.privileged",
} as const;

export interface ActorContext {
  userId: string;
  email: string;
  ip?: string | null;
  userAgent?: string | null;
}

export async function checkAccess(rbac: RbacService, userId: string, baseKey: string, privilegedKey: string, target: { legalEntityId?: string; recordClassification?: DataClassification }) {
  const base = await rbac.authorize({ userId, permissionKey: baseKey, target });
  if (base.allowed) return base;
  return rbac.authorize({ userId, permissionKey: privilegedKey, target });
}

/** Base ceiling for case-level metadata (case exists, type, status, stage, dates). */
export function baseCeiling(legalEntity: Pick<LegalEntity, "key">): DataClassification {
  return classificationCeilingForEntity(legalEntity);
}

/** One tier above base — restricted HR information (milestone/review detail, reason category). Reuses Organisation's own restricted-tier ceiling unchanged, so SK Lai & Partners' RESTRICTED cap applies identically here. */
export function restrictedCeiling(base: DataClassification): DataClassification {
  return restrictedFieldClassificationCeiling(base);
}

/**
 * One tier above restricted — the highly-restricted tier for
 * recommendation/decision/reason/notes content (PR brief item 17). For
 * SK Lai & Partners (whose base ceiling is already RESTRICTED, the
 * highest tier Organisation uses), this stays capped at RESTRICTED —
 * exactly mirroring Organisation's own restrictedFieldClassificationCeiling
 * reasoning: SKL data is uniformly gated behind the same privileged tier
 * at every sensitivity level, never a HIGHER tier that would require a
 * permission concept Organisation itself never introduced for SKL.
 */
export function decisionCeiling(restricted: DataClassification): DataClassification {
  return restricted === "RESTRICTED" ? "RESTRICTED" : "PRIVILEGED";
}
