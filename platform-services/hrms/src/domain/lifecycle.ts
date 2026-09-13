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
  | "case_cancelled";

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
