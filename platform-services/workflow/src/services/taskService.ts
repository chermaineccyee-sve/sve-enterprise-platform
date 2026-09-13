/**
 * Task/approval actions: list-assigned, decide, complete, reassign. See
 * docs/architecture/workflow-approval-foundation.md "Tasks", "Approvals",
 * "Concurrency".
 */
import type { WorkflowInstanceRepository, WorkflowStepRepository, WorkflowTaskRepository, WorkflowTaskCandidateRepository, WorkflowTransaction } from "../repositories/types.ts";
import type { RbacService } from "../../../identity/src/services/rbacService.ts";
import type { AuditService } from "../../../identity/src/services/auditService.ts";
import type { UserRepository } from "../../../identity/src/repositories/types.ts";
import type { InstanceEngine } from "./instanceEngine.ts";
import { ForbiddenError } from "../../../identity/src/domain/errors.ts";
import { NotFoundError, ValidationError, InvalidStateError } from "../domain/errors.ts";
import type { WorkflowTask, WorkflowDecision, RecordDecisionInput, TaskFilter } from "../domain/workflow.ts";
import { PERMISSIONS, type ActorContext } from "./access.ts";

export function createTaskService(deps: {
  instances: WorkflowInstanceRepository;
  steps: WorkflowStepRepository;
  tasks: WorkflowTaskRepository;
  taskCandidates: WorkflowTaskCandidateRepository;
  rbac: RbacService;
  users: UserRepository;
  audit: AuditService;
  transactions: WorkflowTransaction;
  engine: InstanceEngine;
}) {
  /**
   * Is `actor` currently eligible to act on `task` — a fixed match for
   * USER/MANAGER modes, or (review correction) membership in that task's
   * OWN immutable, resolved-at-activation `workflow_task_candidates` set
   * for ROLE mode. Never a live RBAC re-check: a later role grant/
   * revocation must not silently change who may act on an
   * already-activated task — see docs "Role-change semantics after
   * activation".
   */
  async function checkEligibility(actor: ActorContext, task: WorkflowTask): Promise<void> {
    if (task.assignmentMode === "ROLE") {
      const isCandidate = await deps.taskCandidates.isCandidate(task.id, actor.userId);
      if (!isCandidate) throw new ForbiddenError(task.assignedPermissionKey ?? PERMISSIONS.APPROVAL_DECIDE);
      return;
    }
    if (task.assignedUserId !== actor.userId) throw new ForbiddenError("This task is not assigned to you.");
  }

  /**
   * PR #10 central active-account invariant: candidate/assignment
   * membership is deliberately snapshotted and never re-checked live (see
   * checkEligibility above) — but account STATUS is a different axis
   * entirely, not a role/permission grant that can legitimately drift
   * after activation. Identity's own rbacService.authorize() already
   * denies a disabled actor everywhere it is called live, but Workflow's
   * task-decision eligibility deliberately bypasses authorize() for
   * candidate stability, so this is the one place that gap needs its own
   * explicit check — added here, at the single authoritative point both
   * decide() and completeTask() share, never scattered per-caller. See
   * docs/architecture/identity-offboarding-revocation.md "Central
   * active-account invariant".
   */
  async function requireActiveAccount(actor: ActorContext): Promise<void> {
    const user = await deps.users.findById(actor.userId);
    if (user && user.status !== "active") throw new ForbiddenError("actor account is not active");
  }

  return {
    async getTask(actor: ActorContext, id: string): Promise<WorkflowTask> {
      const task = await deps.tasks.findById(id);
      if (!task) throw new NotFoundError("Workflow task");
      const instance = await deps.instances.findById(task.instanceId);
      if (!instance) throw new NotFoundError("Workflow task");
      // Reuse the same eligibility notion for reads: assigned user, or
      // ROLE-eligible, or the instance's own requester.
      if (instance.requesterUserId !== actor.userId) {
        try {
          await checkEligibility(actor, task);
        } catch {
          throw new NotFoundError("Workflow task");
        }
      }
      return task;
    },

    /**
     * Tasks fixed-assigned to `actor` (USER/MANAGER), plus ROLE-mode
     * tasks where `actor` appears in that task's own resolved
     * `workflow_task_candidates` set — the repository query already
     * applies this filter (see `WorkflowTaskRepository.listCandidatesForUser`),
     * so no additional live RBAC re-check happens here (review
     * correction: eligibility was already fixed at step-activation time).
     */
    async listAssignedTasks(actor: ActorContext, filter: TaskFilter): Promise<WorkflowTask[]> {
      return deps.tasks.listCandidatesForUser(actor.userId, filter);
    },

    async decide(actor: ActorContext, taskId: string, input: RecordDecisionInput): Promise<{ task: WorkflowTask; decision: WorkflowDecision }> {
      const task = await deps.tasks.findById(taskId);
      if (!task) throw new NotFoundError("Workflow task");
      if (task.taskType !== "APPROVAL") throw new ValidationError("This task is not an approval task.");
      if (task.status !== "PENDING") throw new InvalidStateError("This task has already been decided or cancelled.");

      const instance = await deps.instances.findById(task.instanceId);
      if (!instance) throw new NotFoundError("Workflow task");
      await checkEligibility(actor, task);
      await requireActiveAccount(actor);

      const step = await deps.steps.findById(task.stepId);
      if (!step) throw new NotFoundError("Workflow step");
      if (!step.permittedDecisions?.includes(input.decision)) {
        throw new ValidationError(`This step does not permit the '${input.decision}' decision.`);
      }
      // Final self-approval safety net (PR brief item 15) — MANAGER/USER
      // routing already refuses to create a task for the subject actor at
      // activation time; ROLE mode cannot know the decider in advance, so
      // this is its only enforcement point.
      if (!step.allowSelfApproval && instance.subjectActorUserId && actor.userId === instance.subjectActorUserId) {
        throw new ForbiddenError("Self-approval is not permitted for this step.");
      }

      const result = await deps.transactions.run(async (repos, tx) => {
        const transitioned = await repos.tasks.transitionStatus(taskId, "PENDING", { status: "COMPLETED", completedBy: actor.userId });
        if (!transitioned) throw new InvalidStateError("This task has already been decided or cancelled.");
        const { instance: updatedInstance, resultingTransition } = await deps.engine.applyDecisionTransition(repos, instance, step, input.decision, actor.userId, tx);
        const decision = await repos.decisions.create({ taskId, instanceId: instance.id, actorUserId: actor.userId, decision: input.decision, comment: input.comment ?? null, resultingTransition });
        await repos.events.append({ instanceId: instance.id, eventType: "decision_recorded", eventData: { taskId, decision: input.decision, actorUserId: actor.userId, resultingTransition }, notes: input.comment ?? null, recordedBy: actor.userId });
        void updatedInstance;
        return { task: transitioned, decision };
      });

      await deps.audit.record({ actorUserId: actor.userId, actorEmail: actor.email, action: "workflow.approval.decided", resourceType: "workflow_task", resourceId: taskId, legalEntityId: instance.legalEntityId, changeAfter: { decision: input.decision } });
      return result;
    },

    async completeTask(actor: ActorContext, taskId: string): Promise<WorkflowTask> {
      const task = await deps.tasks.findById(taskId);
      if (!task) throw new NotFoundError("Workflow task");
      if (task.taskType !== "TASK") throw new ValidationError("This task is an approval task — use the decide endpoint.");
      if (task.status !== "PENDING") throw new InvalidStateError("This task has already been completed or cancelled.");

      const instance = await deps.instances.findById(task.instanceId);
      if (!instance) throw new NotFoundError("Workflow task");
      await checkEligibility(actor, task);
      await requireActiveAccount(actor);

      const step = await deps.steps.findById(task.stepId);
      if (!step) throw new NotFoundError("Workflow step");

      const completed = await deps.transactions.run(async (repos, tx) => {
        const transitioned = await repos.tasks.transitionStatus(taskId, "PENDING", { status: "COMPLETED", completedBy: actor.userId });
        if (!transitioned) throw new InvalidStateError("This task has already been completed or cancelled.");
        await deps.engine.applyTaskCompletion(repos, instance, step, actor.userId, tx);
        return transitioned;
      });

      await deps.audit.record({ actorUserId: actor.userId, actorEmail: actor.email, action: "workflow.task.completed", resourceType: "workflow_task", resourceId: taskId, legalEntityId: instance.legalEntityId });
      return completed;
    },

    async reassignTask(actor: ActorContext, taskId: string, input: { userId: string }): Promise<WorkflowTask> {
      const task = await deps.tasks.findById(taskId);
      if (!task) throw new NotFoundError("Workflow task");
      if (task.status !== "PENDING") throw new InvalidStateError("Only a PENDING task can be reassigned.");
      const instance = await deps.instances.findById(task.instanceId);
      if (!instance) throw new NotFoundError("Workflow task");

      const access = await deps.rbac.authorize({ userId: actor.userId, permissionKey: PERMISSIONS.TASK_REASSIGN, target: { legalEntityId: instance.legalEntityId, recordClassification: instance.dataClassification as never } });
      if (!access.allowed) {
        const privileged = await deps.rbac.authorize({ userId: actor.userId, permissionKey: PERMISSIONS.TASK_REASSIGN_PRIVILEGED, target: { legalEntityId: instance.legalEntityId, recordClassification: instance.dataClassification as never } });
        if (!privileged.allowed) throw new ForbiddenError(PERMISSIONS.TASK_REASSIGN);
      }

      const updated = await deps.transactions.run(async (repos) => {
        const reassigned = await repos.tasks.reassign(taskId, { assignedUserId: input.userId });
        await repos.events.append({ instanceId: instance.id, eventType: "task_reassigned", eventData: { taskId, assignedUserId: input.userId }, recordedBy: actor.userId });
        return reassigned;
      });
      await deps.audit.record({ actorUserId: actor.userId, actorEmail: actor.email, action: "workflow.task.reassigned", resourceType: "workflow_task", resourceId: taskId, legalEntityId: instance.legalEntityId, changeAfter: { assignedUserId: input.userId } });
      return updated;
    },
  };
}

export type TaskService = ReturnType<typeof createTaskService>;
