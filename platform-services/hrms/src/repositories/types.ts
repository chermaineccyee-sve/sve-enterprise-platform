/**
 * Repository interfaces for HRMS Employee Lifecycle. Services depend on
 * these, never on a concrete DatabaseProvider/SQL client directly —
 * mirrors Identity's and Organisation's own repository-pattern convention.
 */
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
  list(filter: LifecycleCaseFilter): Promise<HrLifecycleCase[]>;
  updateStatus(id: string, input: { status: LifecycleStatus; currentStage?: string | null; outcome?: string | null; effectiveDate?: string | null; resultingAssignmentId?: string | null; updatedBy: string }): Promise<HrLifecycleCase>;
  /** Draws the next value from hr_lifecycle_case_seq — never a row count or client-supplied value. */
  nextCaseNumberSeq(): Promise<number>;
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
 */
export interface LifecycleTransaction {
  run<T>(fn: (repos: { cases: LifecycleCaseRepository; events: LifecycleEventRepository; milestones: LifecycleMilestoneRepository; reviews: ProbationReviewRepository }) => Promise<T>): Promise<T>;
}
