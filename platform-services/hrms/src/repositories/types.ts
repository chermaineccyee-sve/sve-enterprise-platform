/**
 * Repository interfaces for HRMS Employee Lifecycle. Services depend on
 * these, never on a concrete DatabaseProvider/SQL client directly —
 * mirrors Identity's and Organisation's own repository-pattern convention.
 */
import type { DatabaseProvider } from "../../../../packages/shared/src/DatabaseProvider.ts";
import type {
  HrLifecycleCase,
  HrLifecycleEvent,
  HrLifecycleMilestone,
  HrProbationReview,
  LifecycleStatus,
  LifecycleEventType,
  MilestoneStatus,
  ProbationDecision,
  CreateLifecycleCaseInput,
  LifecycleCaseFilter,
  CreateMilestoneInput,
} from "../domain/lifecycle.ts";

export interface LifecycleCaseRepository {
  create(input: CreateLifecycleCaseInput & { caseNumber: string; createdBy: string }): Promise<HrLifecycleCase>;
  findById(id: string): Promise<HrLifecycleCase | null>;
  /**
   * Same as findById, but (on the real Postgres implementation) takes a
   * row-level `SELECT ... FOR UPDATE` lock, held until the enclosing
   * transaction commits or rolls back. Used only by completions that must
   * be safe under concurrent duplicate requests (employment-change/
   * offboarding) — see docs/architecture/hrms-employee-lifecycle.md
   * "Transaction boundaries" and "Concurrency". A second concurrent caller
   * blocks here until the first's transaction ends, then re-reads the
   * row's now-committed status, so a terminal case is never processed
   * twice. The in-memory implementation has no real concurrent
   * transactions to guard against and behaves exactly like findById.
   */
  findByIdForUpdate(id: string): Promise<HrLifecycleCase | null>;
  list(filter: LifecycleCaseFilter): Promise<HrLifecycleCase[]>;
  updateStatus(
    id: string,
    input: {
      status: LifecycleStatus;
      currentStage?: string | null;
      outcome?: string | null;
      effectiveDate?: string | null;
      resultingAssignmentId?: string | null;
      /** Set once, at submitForApproval() time (PR #9) — never touched by any other transition. */
      pendingCompletionInput?: Record<string, unknown> | null;
      updatedBy: string;
    },
  ): Promise<HrLifecycleCase>;
  /** Draws the next value from hr_lifecycle_case_seq — never a row count or client-supplied value. */
  nextCaseNumberSeq(): Promise<number>;
  /**
   * Stamps the REFERENCE to the Workflow instance now approving this case
   * (PR #9) — never a copy of Workflow's own status. Overwrites any prior
   * value (a resubmission after rejection points this at the NEW
   * instance). See docs/architecture/hrms-workflow-integration.md "HRMS
   * <-> Workflow linkage".
   */
  linkWorkflowInstance(id: string, workflowInstanceId: string): Promise<HrLifecycleCase>;
}

export interface LifecycleEventRepository {
  append(input: { caseId: string; eventType: LifecycleEventType; eventData?: Record<string, unknown> | null; notes?: string | null; recordedBy: string }): Promise<HrLifecycleEvent>;
  listByCase(caseId: string): Promise<HrLifecycleEvent[]>;
}

export interface LifecycleMilestoneRepository {
  create(caseId: string, input: CreateMilestoneInput): Promise<HrLifecycleMilestone>;
  findById(id: string): Promise<HrLifecycleMilestone | null>;
  listByCase(caseId: string): Promise<HrLifecycleMilestone[]>;
  updateStatus(id: string, input: { status: MilestoneStatus; completedBy?: string | null; notes?: string | null }): Promise<HrLifecycleMilestone>;
}

export interface ProbationReviewRepository {
  create(input: { caseId: string; sequenceNumber: number; periodStart: string; expectedReviewDate: string; responsibleManagerUserId: string | null; responsibleHrOwnerUserId: string }): Promise<HrProbationReview>;
  findById(id: string): Promise<HrProbationReview | null>;
  findCurrent(caseId: string): Promise<HrProbationReview | null>;
  listByCase(caseId: string): Promise<HrProbationReview[]>;
  recordDecision(id: string, input: { decision: ProbationDecision; recommendation: string | null; decisionNotes: string | null; decisionDate: string; decidedBy: string }): Promise<HrProbationReview>;
}

/**
 * Runs case creation + its initial event atomically — mirrors
 * platform-services/organisation's EmployeeCreationTransaction (PR #6's
 * lesson: authoritative multi-row writes must be atomic). See docs/
 * architecture/hrms-employee-lifecycle.md "Transaction boundaries".
 *
 * `fn`'s second parameter is the raw, transaction-scoped DatabaseProvider
 * connection underlying `repos` — exposed so a caller can bind OTHER
 * packages' repositories (via their own transaction-scoped composition
 * helpers, e.g. platform-services/organisation's
 * createEmploymentAssignmentServiceForTransaction) to the exact same
 * Postgres transaction, letting Organisation's own authoritative write
 * join HRMS's own case-completion write as one atomic unit. The in-memory
 * implementation has no real connection to expose; it passes a stub that
 * throws if actually used, since in-memory callers reuse the shared
 * in-memory Organisation service directly instead.
 */
export interface LifecycleTransaction {
  run<T>(fn: (repos: { cases: LifecycleCaseRepository; events: LifecycleEventRepository; milestones: LifecycleMilestoneRepository; reviews: ProbationReviewRepository }, tx: DatabaseProvider) => Promise<T>): Promise<T>;
}
