/**
 * Repository interfaces for Workflow & Approval Foundation. Services
 * depend on these, never on a concrete DatabaseProvider/SQL client
 * directly — mirrors Identity/Organisation/HRMS's own repository-pattern
 * convention.
 */
import type {
  WorkflowDefinition,
  WorkflowDefinitionVersion,
  WorkflowStep,
  WorkflowInstance,
  WorkflowTask,
  WorkflowDecision,
  WorkflowEvent,
  WorkflowSystemActionExecution,
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
  /** Tasks fixed-assigned to this user, or ROLE-mode tasks (eligibility checked separately at read time by the service). */
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

export interface WorkflowTxRepos {
  definitions: WorkflowDefinitionRepository;
  versions: WorkflowDefinitionVersionRepository;
  steps: WorkflowStepRepository;
  instances: WorkflowInstanceRepository;
  tasks: WorkflowTaskRepository;
  decisions: WorkflowDecisionRepository;
  events: WorkflowEventRepository;
  systemActions: WorkflowSystemActionExecutionRepository;
}

/**
 * Runs a set of writes atomically — mirrors platform-services/hrms's
 * LifecycleTransaction exactly. Does not expose a raw DatabaseProvider
 * connection: no operation in this PR needs to bind another package's
 * repositories to this same transaction (no real cross-domain
 * SYSTEM_ACTION handler is registered yet — see docs "Cross-domain
 * transactions" for how a future one would gain that capability,
 * following platform-services/hrms's own
 * createEmploymentAssignmentServiceForTransaction precedent).
 */
export interface WorkflowTransaction {
  run<T>(fn: (repos: WorkflowTxRepos) => Promise<T>): Promise<T>;
}
