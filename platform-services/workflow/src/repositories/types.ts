/**
 * Repository interfaces for Workflow & Approval Foundation. Services
 * depend on these, never on a concrete DatabaseProvider/SQL client
 * directly — mirrors Identity/Organisation/HRMS's own repository-pattern
 * convention.
 */
import type { DatabaseProvider } from "../../../../packages/shared/src/DatabaseProvider.ts";
import type {
  WorkflowDefinition,
  WorkflowDefinitionVersion,
  WorkflowStep,
  WorkflowInstance,
  WorkflowTask,
  WorkflowDecision,
  WorkflowEvent,
  WorkflowSystemActionExecution,
  WorkflowTaskCandidate,
  DefinitionVersionStatus,
  CreateStepInput,
  InstanceStatus,
  FailureCategory,
  InstanceFilter,
  TaskFilter,
  TaskStatus,
  SystemActionExecutionStatus,
} from "../domain/workflow.ts";

export interface WorkflowDefinitionRepository {
  create(input: { key: string; name: string; description?: string | null; createdBy: string }): Promise<WorkflowDefinition>;
  findById(id: string): Promise<WorkflowDefinition | null>;
  /** Row-level lock (SELECT ... FOR UPDATE on Postgres), held until the enclosing transaction ends — the concurrency-safety mechanism for version-number assignment (PR brief item 33). The in-memory implementation behaves like findById. */
  findByIdForUpdate(id: string): Promise<WorkflowDefinition | null>;
  findByKey(key: string): Promise<WorkflowDefinition | null>;
  list(): Promise<WorkflowDefinition[]>;
}

export interface WorkflowDefinitionVersionRepository {
  /** Caller must already hold the definition's row lock (findByIdForUpdate) and have computed `versionNumber` from the current max — see definitionService.ts. */
  create(input: { definitionId: string; versionNumber: number; createdBy: string }): Promise<WorkflowDefinitionVersion>;
  findById(id: string): Promise<WorkflowDefinitionVersion | null>;
  /** Row-level lock — serializes publish against concurrent step edits on the SAME version (both must acquire this lock before writing). The in-memory implementation behaves like findById. */
  findByIdForUpdate(id: string): Promise<WorkflowDefinitionVersion | null>;
  listByDefinition(definitionId: string): Promise<WorkflowDefinitionVersion[]>;
  maxVersionNumber(definitionId: string): Promise<number>;
  updateStatus(id: string, input: { status: DefinitionVersionStatus }): Promise<WorkflowDefinitionVersion>;
}

export interface WorkflowStepRepository {
  create(versionId: string, input: CreateStepInput): Promise<WorkflowStep>;
  findById(id: string): Promise<WorkflowStep | null>;
  listByVersion(versionId: string): Promise<WorkflowStep[]>;
  findBySequence(versionId: string, sequenceNumber: number): Promise<WorkflowStep | null>;
  update(id: string, input: Partial<CreateStepInput>): Promise<WorkflowStep>;
  delete(id: string): Promise<void>;
}

export interface WorkflowInstanceRepository {
  create(input: {
    definitionId: string;
    versionId: string;
    subjectType: string;
    subjectId: string;
    legalEntityId: string;
    dataClassification: string;
    subjectEmployeeId?: string | null;
    requesterUserId: string;
    subjectActorUserId?: string | null;
    idempotencyKey?: string | null;
    context?: Record<string, unknown> | null;
    createdBy: string;
  }): Promise<WorkflowInstance>;
  findById(id: string): Promise<WorkflowInstance | null>;
  /** Row-level lock — the concurrency-safety mechanism for "at most one committed decision/advance per instance at a time" (PR brief item 19). The in-memory implementation behaves like findById. */
  findByIdForUpdate(id: string): Promise<WorkflowInstance | null>;
  findByIdempotencyKey(definitionId: string, idempotencyKey: string): Promise<WorkflowInstance | null>;
  list(filter: InstanceFilter): Promise<WorkflowInstance[]>;
  updateProgress(
    id: string,
    input: {
      status: InstanceStatus;
      currentStepId?: string | null;
      outcome?: string | null;
      failureCategory?: FailureCategory | null;
    },
  ): Promise<WorkflowInstance>;
}

export interface WorkflowTaskRepository {
  create(input: {
    instanceId: string;
    stepId: string;
    taskType: "APPROVAL" | "TASK";
    assignmentMode: "USER" | "ROLE" | "MANAGER";
    assignedUserId?: string | null;
    assignedPermissionKey?: string | null;
    dueAt?: string | null;
    escalateAfter?: string | null;
    escalationTargetMode: "NONE" | "REASSIGN_TO_ASSIGNEE_MANAGER";
  }): Promise<WorkflowTask>;
  findById(id: string): Promise<WorkflowTask | null>;
  listByInstance(instanceId: string): Promise<WorkflowTask[]>;
  /**
   * Tasks actionable by this user: fixed-assigned to them (USER/MANAGER),
   * or ROLE-mode tasks where they appear in that task's OWN resolved
   * workflow_task_candidates set (never a live role/permission
   * re-check — see WorkflowTaskCandidateRepository).
   */
  listCandidatesForUser(userId: string, filter: TaskFilter): Promise<WorkflowTask[]>;
  /**
   * Conditional status transition guarded by the CURRENT status — returns
   * null (no row updated) if the task is no longer in `expectedStatus`,
   * which is exactly what "prevent double decision"/"prevent decision
   * after cancellation" (PR brief item 18) needs. Mirrors
   * platform-services/hrms's pgProbationReviewRepository.recordDecision()
   * guard.
   */
  transitionStatus(
    id: string,
    expectedStatus: TaskStatus,
    input: { status: TaskStatus; completedBy?: string | null },
  ): Promise<WorkflowTask | null>;
  /**
   * System-initiated reassignment as part of escalation processing —
   * distinct from a manual reassignTask() call: this ALSO stamps
   * escalatedAt, guarded by `escalated_at IS NULL` so two concurrent
   * escalation sweeps can never both escalate the same task. Returns
   * null if another sweep already escalated it first.
   */
  markEscalated(id: string, input: { assignedUserId?: string | null }): Promise<WorkflowTask | null>;
  /** Manual, human-initiated reassignment (PR brief item 13's TASK_REASSIGN permission) — does not touch escalatedAt. */
  reassign(id: string, input: { assignedUserId: string }): Promise<WorkflowTask>;
  listDueForEscalation(now: string): Promise<WorkflowTask[]>;
}

export interface WorkflowDecisionRepository {
  /** Relies on the DB's UNIQUE(task_id) constraint (Postgres) to guarantee at most one decision per task ever commits — see docs "Concurrency". The in-memory implementation checks-then-inserts, sufficient for single-threaded unit tests. */
  create(input: {
    taskId: string;
    instanceId: string;
    actorUserId: string;
    decision: "APPROVE" | "REJECT" | "RETURN";
    comment?: string | null;
    resultingTransition: string;
  }): Promise<WorkflowDecision>;
  findByTaskId(taskId: string): Promise<WorkflowDecision | null>;
  listByInstance(instanceId: string): Promise<WorkflowDecision[]>;
}

export interface WorkflowEventRepository {
  append(input: {
    instanceId: string;
    eventType: WorkflowEvent["eventType"];
    eventData?: Record<string, unknown> | null;
    notes?: string | null;
    recordedBy?: string | null;
  }): Promise<WorkflowEvent>;
  listByInstance(instanceId: string): Promise<WorkflowEvent[]>;
}

export interface WorkflowSystemActionExecutionRepository {
  /** Relies on UNIQUE(instance_id, step_id) (Postgres) for idempotency — a second attempt for the same instance+step returns the EXISTING row rather than creating a duplicate. */
  findOrCreate(input: { instanceId: string; stepId: string; handlerKey: string }): Promise<{ execution: WorkflowSystemActionExecution; created: boolean }>;
  updateStatus(id: string, input: { status: SystemActionExecutionStatus; attempts: number; lastError?: string | null }): Promise<WorkflowSystemActionExecution>;
}

/**
 * The ROLE-routing review correction: the immutable, resolved-once
 * eligible-actor set for a single ROLE-mode task, recorded at the exact
 * moment its step activated. See docs "ROLE routing semantics" and
 * "Role-change semantics after activation" for why this table exists
 * instead of a live RBAC re-check at decision time.
 */
export interface WorkflowTaskCandidateRepository {
  /** Called exactly once per task, immediately after task creation, inside the SAME transaction. Never called again for that task. */
  recordCandidates(taskId: string, userIds: string[]): Promise<void>;
  isCandidate(taskId: string, userId: string): Promise<boolean>;
  listCandidateUserIds(taskId: string): Promise<string[]>;
  /** For history/inspection — e.g. an audit trail of exactly who was eligible when a task activated. */
  listByTask(taskId: string): Promise<WorkflowTaskCandidate[]>;
}

export interface WorkflowTxRepos {
  definitions: WorkflowDefinitionRepository;
  versions: WorkflowDefinitionVersionRepository;
  steps: WorkflowStepRepository;
  instances: WorkflowInstanceRepository;
  tasks: WorkflowTaskRepository;
  taskCandidates: WorkflowTaskCandidateRepository;
  decisions: WorkflowDecisionRepository;
  events: WorkflowEventRepository;
  systemActions: WorkflowSystemActionExecutionRepository;
}

/**
 * Runs a set of writes atomically — mirrors platform-services/hrms's
 * LifecycleTransaction exactly, INCLUDING exposing the raw, transaction-
 * scoped DatabaseProvider connection as `fn`'s second parameter (PR #9
 * addition — the original PR #8 shape took only `repos`, since no real
 * cross-domain SYSTEM_ACTION handler existed yet to bind to it). A
 * registered handler that needs to call into another package's own
 * transaction-scoped composition helper (e.g. HRMS's
 * createLifecycleCaseServiceForTransaction, itself following
 * Organisation's createEmploymentAssignmentServiceForTransaction
 * precedent) receives this connection via SystemActionContext.tx — see
 * docs/architecture/hrms-workflow-integration.md "Transaction boundary".
 * The in-memory implementation has no real connection to expose; it
 * passes a stub that throws if actually used (see
 * inMemoryWorkflowTransaction.ts).
 */
export interface WorkflowTransaction {
  run<T>(fn: (repos: WorkflowTxRepos, tx: DatabaseProvider) => Promise<T>): Promise<T>;
}
