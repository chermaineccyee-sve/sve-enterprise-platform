/**
 * HRMS Employee Lifecycle domain types, mirroring database/migrations/
 * 004_hrms-employee-lifecycle/migration.sql. See docs/architecture/
 * hrms-employee-lifecycle.md "Lifecycle case model".
 *
 * This is the HR PROCESS layer — it consumes, and never duplicates,
 * Employee Master (platform-services/organisation): a case references an
 * employeeId/legalEntityId, it does not carry its own copy of employee
 * identity or employment-assignment fields. Deliberately excluded (PR
 * brief item 17): salary, bank details, tax identifiers, medical
 * information, government identifiers, statutory contribution data.
 */

export type LifecycleType = "onboarding" | "probation" | "employment_change" | "offboarding";

/**
 * A single, generic status set shared by every lifecycle type — the
 * brief's illustrative example (Draft → In Progress → Pending Decision →
 * Completed, with cancellation) generalises cleanly across all four
 * types, so no per-type status set was introduced. See the architecture
 * doc "State transitions" for the legal-transition table this backs.
 */
export type LifecycleStatus = "DRAFT" | "IN_PROGRESS" | "PENDING_DECISION" | "COMPLETED" | "CANCELLED";

export interface HrLifecycleCase {
  id: string;
  caseNumber: string;
  employeeId: string;
  legalEntityId: string;
  lifecycleType: LifecycleType;
  /** Free text, meaning depends on lifecycleType (e.g. 'promotion' for employment_change, 'resignation' for offboarding). */
  caseSubtype: string | null;
  status: LifecycleStatus;
  /** Free text, finer-grained progress within a status — service-validated per lifecycleType, not a state machine of its own. */
  currentStage: string | null;
  initiatedAt: string;
  effectiveDate: string | null;
  hrOwnerUserId: string;
  outcome: string | null;
  reasonCategory: string | null;
  /** Offboarding-only. */
  noticeDate: string | null;
  /** Offboarding-only. */
  intendedLastWorkingDate: string | null;
  /** Set once an employment_change/offboarding case invokes Organisation's authoritative assignment transition. */
  resultingAssignmentId: string | null;
  /**
   * A REFERENCE to the Workflow instance approving this case (PR #9) —
   * never a copy of Workflow's own status/outcome, which is always read
   * live via the integration port. NULL until submitForApproval()
   * succeeds; overwritten on a later resubmission after rejection. See
   * docs/architecture/hrms-workflow-integration.md "HRMS <-> Workflow
   * linkage".
   */
  workflowInstanceId: string | null;
  /**
   * The employment-change assignment terms / offboarding separation terms
   * this case's approval will apply, captured once at submitForApproval()
   * time and consumed by the registered SYSTEM_ACTION handler once
   * approved — see docs/architecture/hrms-workflow-integration.md
   * "Employment Change" / "Offboarding". Never copied into Workflow's own
   * payloads.
   */
  pendingCompletionInput: Record<string, unknown> | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
}

export type LifecycleEventType =
  | "case_opened"
  | "stage_changed"
  | "milestone_completed"
  | "review_recorded"
  | "recommendation_recorded"
  | "decision_recorded"
  | "probation_extended"
  | "confirmation_completed"
  | "employment_change_authorised"
  | "employment_change_completed"
  | "offboarding_initiated"
  | "separation_effective"
  | "identity_deactivation_requested"
  | "case_completed"
  | "case_cancelled"
  | "approval_submitted"
  | "approval_rejected";

/**
 * Append-only business lifecycle history — never updated or deleted by
 * application code. Distinct from Identity's security_audit_events (see
 * the architecture doc "Audit model"): `eventData` is small, non-sensitive
 * structured metadata; `notes` is the one field carrying substantive
 * decision/rationale content, gated at the "decision" classification tier.
 */
export interface HrLifecycleEvent {
  id: string;
  caseId: string;
  eventType: LifecycleEventType;
  eventData: Record<string, unknown> | null;
  notes: string | null;
  occurredAt: string;
  recordedBy: string;
}

export type DeactivationRequestStatus = "REQUESTED" | "COMPLETED";

/**
 * PR #10: a durable, HRMS-owned request driving controlled Identity
 * account revocation after this case's offboarding completes. Created
 * once, atomically, in the SAME transaction as the offboarding
 * completion itself (never a second, separate write that could leave an
 * `identity_deactivation_requested` event with no corresponding durable
 * row) — see docs/architecture/identity-offboarding-revocation.md
 * "Deactivation request lifecycle".
 *
 * status is intentionally 2-valued: a failed processing attempt is
 * recorded as metadata (failureReason / attemptCount / lastAttemptedAt)
 * on a row that STAYS "REQUESTED" — it is never a status transition to a
 * terminal "FAILED" state. This is what makes the request genuinely,
 * automatically retryable by identityDeactivationProcessor.ts's own
 * batch sweep (which selects status === "REQUESTED"), rather than only
 * reachable via a manual, by-id retry. Only a successful disable moves a
 * row to the terminal "COMPLETED" status.
 */
export interface HrIdentityDeactivationRequest {
  id: string;
  caseId: string;
  employeeId: string;
  targetUserId: string;
  requestedBy: string;
  reasonCategory: string;
  status: DeactivationRequestStatus;
  requestedAt: string;
  completedAt: string | null;
  failureReason: string | null;
  attemptCount: number;
  lastAttemptedAt: string | null;
}

export type MilestoneStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";

/** Onboarding tasks and offboarding clearance items share this one shape. `reference` is metadata only — a future Document/acknowledgement-service record id, never a binary. */
export interface HrLifecycleMilestone {
  id: string;
  caseId: string;
  milestoneType: string;
  status: MilestoneStatus;
  dueDate: string | null;
  completedAt: string | null;
  completedBy: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ProbationDecision = "CONFIRMED" | "EXTENDED" | "UNSUCCESSFUL";

/**
 * One row per probation PERIOD — the original, plus one additional row
 * per extension. An extension INSERTs a new row (next sequenceNumber);
 * it never overwrites a prior period's dates. "Current" is the row with
 * the highest sequenceNumber for a case. See the architecture doc
 * "Probation extension integrity".
 */
export interface HrProbationReview {
  id: string;
  caseId: string;
  sequenceNumber: number;
  periodStart: string;
  expectedReviewDate: string;
  responsibleManagerUserId: string | null;
  responsibleHrOwnerUserId: string;
  reviewStatus: "PENDING" | "COMPLETED";
  recommendation: string | null;
  decision: ProbationDecision | null;
  decisionNotes: string | null;
  decisionDate: string | null;
  decidedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLifecycleCaseInput {
  employeeId: string;
  legalEntityId: string;
  lifecycleType: LifecycleType;
  caseSubtype?: string | null;
  currentStage?: string | null;
  effectiveDate?: string | null;
  hrOwnerUserId: string;
  reasonCategory?: string | null;
  noticeDate?: string | null;
  intendedLastWorkingDate?: string | null;
}

export interface LifecycleCaseFilter {
  employeeId?: string;
  legalEntityId?: string;
  lifecycleType?: LifecycleType;
  status?: LifecycleStatus;
}

export interface CreateMilestoneInput {
  milestoneType: string;
  dueDate?: string | null;
  reference?: string | null;
  notes?: string | null;
}

export interface CreateProbationReviewInput {
  periodStart: string;
  expectedReviewDate: string;
  responsibleManagerUserId?: string | null;
  responsibleHrOwnerUserId: string;
}

export interface RecordProbationDecisionInput {
  decision: ProbationDecision;
  recommendation?: string | null;
  decisionNotes?: string | null;
  decisionDate: string;
  /** Required when decision === 'EXTENDED' — the next probation period's terms, supplied by the caller (never invented/defaulted by this system — see the architecture doc "No universal probation duration"). */
  extension?: { periodStart: string; expectedReviewDate: string; responsibleManagerUserId?: string | null; responsibleHrOwnerUserId?: string | null } | null;
}
