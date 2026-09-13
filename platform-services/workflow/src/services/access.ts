/**
 * Shared RBAC/classification helpers for every Workflow service — mirrors
 * platform-services/hrms's access.ts pattern (two-tier ordinary/.privileged
 * permission keys standing in for a classification ceiling Identity's
 * rbacService already enforces) rather than inventing a new authorization
 * mechanism. See docs/architecture/workflow-approval-foundation.md
 * "Permissions" and "Entity and classification security".
 *
 * Reuses (never re-derives) platform-services/organisation's SK Lai &
 * Partners classification-ceiling logic — imported by source path, the
 * same cross-package dependency direction Organisation/HRMS themselves
 * use for Identity's contracts.
 */
import type { RbacService } from "../../../identity/src/services/rbacService.ts";
import type { LegalEntity } from "../../../identity/src/domain/entities.ts";
import type { DataClassification } from "../../../../packages/types/src/entity-context.ts";
import { classificationCeilingForEntity } from "../../../organisation/src/services/entityClassification.ts";

export const PERMISSIONS = {
  DEFINITION_READ: "workflow.definition.read",
  DEFINITION_CREATE: "workflow.definition.create",
  DEFINITION_UPDATE: "workflow.definition.update",
  DEFINITION_PUBLISH: "workflow.definition.publish",
  DEFINITION_RETIRE: "workflow.definition.retire",

  INSTANCE_START: "workflow.instance.start",
  INSTANCE_START_PRIVILEGED: "workflow.instance.start.privileged",
  INSTANCE_READ: "workflow.instance.read",
  INSTANCE_READ_PRIVILEGED: "workflow.instance.read.privileged",
  INSTANCE_CANCEL: "workflow.instance.cancel",
  INSTANCE_CANCEL_PRIVILEGED: "workflow.instance.cancel.privileged",

  TASK_READ_ASSIGNED: "workflow.task.read.assigned",
  TASK_COMPLETE_ASSIGNED: "workflow.task.complete.assigned",
  TASK_COMPLETE_ASSIGNED_PRIVILEGED: "workflow.task.complete.assigned.privileged",
  TASK_REASSIGN: "workflow.task.reassign",
  TASK_REASSIGN_PRIVILEGED: "workflow.task.reassign.privileged",

  APPROVAL_DECIDE: "workflow.approval.decide",
  APPROVAL_DECIDE_PRIVILEGED: "workflow.approval.decide.privileged",

  OPERATION_PROCESS_ESCALATIONS: "workflow.operation.process_escalations",
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

/** The classification ceiling an instance's own ENTITY imposes — reused unchanged from Organisation so SK Lai & Partners' RESTRICTED cap applies identically here (docs "SK Lai & Partners"). */
export function entityCeiling(legalEntity: Pick<LegalEntity, "key">): DataClassification {
  return classificationCeilingForEntity(legalEntity);
}
