/**
 * Task/approval actions: list-assigned, decide, complete, reassign. See
 * docs/architecture/workflow-approval-foundation.md "Tasks", "Approvals",
 * "Concurrency".
 */
import type { WorkflowInstanceRepository, WorkflowStepRepository, WorkflowTaskRepository, WorkflowTransaction } from "../repositories/types.ts";
import type { RbacService } from "../../../identity/src/services/rbacService.ts";
import type { AuditService } from "../../../identity/src/services/auditService.ts";
import type { InstanceEngine } from "./instanceEngine.ts";
import { ForbiddenError } from "../../../identity/src/domain/errors.ts";
import { NotFoundError, ValidationError, InvalidStateError } from "../domain/errors.ts";
import type { WorkflowTask, WorkflowDecision, RecordDecisionInput, TaskFilter } from "../domain/workflow.ts";
import { PERMISSIONS, type ActorContext } from "./access.ts";

export function createTaskService(deps: {
  instances: WorkflowInstanceRepository;
  steps: WorkflowStepRepository;
  tasks: WorkflowTaskRepository;
  rbac: RbacService;
  audit: AuditService;
  transactions: WorkflowTransaction;
  engine: InstanceEngine;
}) {
  /** Is `actor` currently eligible to act on `task` — a fixed match for USER/MANAGER modes, or a live permission check for ROLE mode (PR brief item 13: "no eligible approver" is possible for ROLE mode by design — see docs "Remaining risks"). */
  async function checkEligibility(actor: ActorContext, task: WorkflowTask, instance: { legalEntityId: string; dataClassification: string }): Promise<void> {
    if (task.assignmentMode === "ROLE") {
      if (!task.assignedPermissionKey) throw new ForbiddenError(PERMISSIONS.APPROVAL_DECIDE);
      const result = await deps.rbac.authorize({ userId: actor.userId, permissionKey: task.assignedPermissionKey, target: { legalEntityId: instance.legalEntityId, recordClassification: instance.dataClassification as never } });
      if (!result.allowed) throw new ForbiddenError(task.assignedPermissionKey);
      return;
    }
    if (task.assignedUserId !== actor.userId) throw new ForbiddenError("This task is not assigned to you.");
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
          await checkEligibility(actor, task, instance);
        } catch {
          throw new NotFoundError("Workflow task");
        }
      }
      return task;
    },

    async listAssignedTasks(actor: ActorContext, filter: TaskFilter): Promise<WorkflowTask[]> {
      const candidates = await deps.tasks.listCandidatesForUser(actor.userId, filter);
      const eligible: WorkflowTask[] = [];
      for (const task of candidates) {
        if (task.assignmentMode !== "ROLE") {
          eligible.push(task);
          continue;
        }
        if (!task.assignedPermissionKey) continue;
        const instance = await deps.instances.findById(task.instanceId);
        if (!instance) continue;
        const result = await deps.rbac.authorize({ userId: actor.userId, permissionKey: task.assignedPermissionKey, target: { legalEntityId: instance.legalEntityId, recordClassification: instance.dataClassification as never } });
        if (result.allowed) eligible.push(task);
      }
      return eligible;
    },

    async decide(actor: ActorContext, taskId: string, input: RecordDecisionInput): Promise<{ task: WorkflowTask; decision: WorkflowDecision }> {
      const task = await deps.tasks.findById(taskId);
      if (!task) throw new NotFoundError("Workflow task");
      if (task.taskType !== "APPROVAL") throw new ValidationError("This task is not an approval task.");
      if (task.status !== "PENDING") throw new InvalidStateError("This task has already been decided or cancelled.");

      const instance = await deps.instances.findById(task.instanceId);
      if (!instance) throw new NotFoundError("Workflow task");
      await checkEligibility(actor, task, instance);

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

      const result = await deps.transactions.run(async (repos) => {
        const transitioned = await repos.tasks.transitionStatus(taskId, "PENDING", { status: "COMPLETED", completedBy: actor.userId });
        if (!transitioned) throw new InvalidStateError("This task has already been decided or cancelled.");
        const { instance: updatedInstance, resultingTransition } = await deps.engine.applyDecisionTransition(repos, instance, step, input.decision, actor.userId);
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
      await checkEligibility(actor, task, instance);

      const step = await deps.steps.findById(task.stepId);
      if (!step) throw new NotFoundError("Workflow step");

      const completed = await deps.transactions.run(async (repos) => {
        const transitioned = await repos.tasks.transitionStatus(taskId, "PENDING", { status: "COMPLETED", completedBy: actor.userId });
        if (!transitioned) throw new InvalidStateError("This task has already been completed or cancelled.");
        await deps.engine.applyTaskCompletion(repos, instance, step, actor.userId);
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
