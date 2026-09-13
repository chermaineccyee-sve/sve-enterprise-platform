/**
 * Workflow & Approval Foundation domain types, mirroring
 * database/migrations/005_workflow-approval-foundation/migration.sql. See
 * docs/architecture/workflow-approval-foundation.md "Core concepts".
 *
 * This is an ORCHESTRATION layer — it references business subjects
 * (subject_type/subject_id) without owning them, and never stores a copy
 * of the underlying business record (PR brief item 27). Deliberately
 * excluded: full HR files, salary, bank details, medical information,
 * claim receipts, privileged Data Vault contents.
 */

export type DefinitionVersionStatus = "DRAFT" | "PUBLISHED" | "RETIRED";

export interface WorkflowDefinition {
  id: string;
  key: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowDefinitionVersion {
  id: string;
  definitionId: string;
  versionNumber: number;
  status: DefinitionVersionStatus;
  allowParallelSteps: boolean;
  publishedAt: string | null;
  retiredAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type StepType = "APPROVAL" | "TASK" | "SYSTEM_ACTION";
export type AssignmentMode = "USER" | "ROLE" | "MANAGER";
export type ApprovalDecisionType = "APPROVE" | "REJECT" | "RETURN";
export type EscalationTargetMode = "NONE" | "REASSIGN_TO_ASSIGNEE_MANAGER";

export interface WorkflowStep {
  id: string;
  versionId: string;
  sequenceNumber: number;
  stepType: StepType;
  name: string;
  /** APPROVAL/TASK only — null for SYSTEM_ACTION. */
  assignmentMode: AssignmentMode | null;
  /** ROLE mode only — the permission key whose current holders are resolved into a fixed candidate set at step-activation time (see WorkflowTaskCandidate). */
  assignedPermissionKey: string | null;
  /** ROLE mode only, optional — a privileged-tier sibling of assignedPermissionKey (mirroring this codebase's base/.privileged pattern), unioned into the same candidate set. */
  assignedPermissionKeyPrivileged: string | null;
  allowSelfApproval: boolean;
  /** APPROVAL only — the decisions this step permits. */
  permittedDecisions: ApprovalDecisionType[] | null;
  /** SYSTEM_ACTION only — a registered handler key, never executable code. */
  systemActionHandlerKey: string | null;
  dueAfterMinutes: number | null;
  escalateAfterMinutes: number | null;
  escalationTargetMode: EscalationTargetMode;
  createdAt: string;
  updatedAt: string;
}

export type InstanceStatus = "ACTIVE" | "COMPLETED" | "CANCELLED" | "FAILED";
export type FailureCategory = "ROUTING_FAILURE" | "SYSTEM_ACTION_FAILURE" | "INFRASTRUCTURE_FAILURE";

import type { DataClassification } from "../../../../packages/types/src/entity-context.ts";
export type { DataClassification };

export interface WorkflowInstance {
  id: string;
  definitionId: string;
  versionId: string;
  subjectType: string;
  subjectId: string;
  legalEntityId: string;
  dataClassification: DataClassification;
  subjectEmployeeId: string | null;
  requesterUserId: string;
  subjectActorUserId: string | null;
  status: InstanceStatus;
  outcome: string | null;
  failureCategory: FailureCategory | null;
  currentStepId: string | null;
  idempotencyKey: string | null;
  context: Record<string, unknown> | null;
  startedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  createdBy: string;
  updatedAt: string;
}

export type TaskType = "APPROVAL" | "TASK";
export type TaskStatus = "PENDING" | "COMPLETED" | "CANCELLED";

export interface WorkflowTask {
  id: string;
  instanceId: string;
  stepId: string;
  taskType: TaskType;
  assignmentMode: AssignmentMode;
  assignedUserId: string | null;
  /** ROLE mode only — retained as a historical record of which key was resolved; the actual eligible actors for this task are workflow_task_candidates, never re-derived from this key. */
  assignedPermissionKey: string | null;
  status: TaskStatus;
  dueAt: string | null;
  escalateAfter: string | null;
  escalatedAt: string | null;
  escalationTargetMode: EscalationTargetMode;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  completedBy: string | null;
  cancelledAt: string | null;
}

/** Immutable once committed (PR brief item 12) — no update/delete code path exists for this type. */
export interface WorkflowDecision {
  id: string;
  taskId: string;
  instanceId: string;
  actorUserId: string;
  decision: ApprovalDecisionType;
  comment: string | null;
  resultingTransition: string;
  decidedAt: string;
}

export type WorkflowEventType =
  | "instance_started"
  | "step_activated"
  | "task_created"
  | "decision_recorded"
  | "step_completed"
  | "instance_completed"
  | "instance_cancelled"
  | "instance_failed"
  | "routing_failed"
  | "system_action_executed"
  | "system_action_failed"
  | "escalation_triggered"
  | "task_reassigned";

/** Append-only business history — distinct from Identity's security_audit_events. See docs "Audit vs workflow history". */
export interface WorkflowEvent {
  id: string;
  instanceId: string;
  eventType: WorkflowEventType;
  eventData: Record<string, unknown> | null;
  notes: string | null;
  occurredAt: string;
  /** Null for system-initiated events (e.g. an escalation sweep). */
  recordedBy: string | null;
}

export type SystemActionExecutionStatus = "PENDING" | "SUCCEEDED" | "FAILED";

export interface WorkflowSystemActionExecution {
  id: string;
  instanceId: string;
  stepId: string;
  handlerKey: string;
  status: SystemActionExecutionStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  executedAt: string | null;
}

/**
 * One row per user resolved as eligible for a ROLE-mode task at the
 * moment its step activated (PR #8 review correction — see docs
 * "ROLE routing semantics"). Immutable, insert-only, written once by
 * `recordCandidates()` when the task is created.
 */
export interface WorkflowTaskCandidate {
  id: string;
  taskId: string;
  userId: string;
  createdAt: string;
}

// --- Input shapes -----------------------------------------------------

export interface CreateStepInput {
  sequenceNumber: number;
  stepType: StepType;
  name: string;
  assignmentMode?: AssignmentMode | null;
  assignedPermissionKey?: string | null;
  assignedPermissionKeyPrivileged?: string | null;
  allowSelfApproval?: boolean;
  permittedDecisions?: ApprovalDecisionType[] | null;
  systemActionHandlerKey?: string | null;
  dueAfterMinutes?: number | null;
  escalateAfterMinutes?: number | null;
  escalationTargetMode?: EscalationTargetMode;
}

export interface StartWorkflowInput {
  definitionKey: string;
  subjectType: string;
  subjectId: string;
  legalEntityId: string;
  dataClassification?: DataClassification;
  subjectEmployeeId?: string | null;
  subjectActorUserId?: string | null;
  idempotencyKey?: string | null;
  context?: Record<string, unknown> | null;
  /** Explicit target for USER-mode steps, keyed by sequenceNumber — required when a USER-mode step exists, since a definition never hard-codes a specific user. */
  stepAssignments?: Record<number, { userId: string }>;
}

export interface RecordDecisionInput {
  decision: ApprovalDecisionType;
  comment?: string | null;
}

export interface InstanceFilter {
  status?: InstanceStatus;
  subjectType?: string;
  subjectId?: string;
  legalEntityId?: string;
  requesterUserId?: string;
}

export interface TaskFilter {
  instanceId?: string;
  status?: TaskStatus;
}
