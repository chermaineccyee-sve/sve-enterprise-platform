/**
 * Escalation processing (PR brief item 17): persists escalation metadata
 * on each task (due_at/escalate_after/escalation_target_mode) and exposes
 * ONE deterministic service method, processDueEscalations(), that a
 * future scheduler (cron, queue worker, manual trigger) can call. No
 * AWS/EventBridge/cron infrastructure is built here — this package has no
 * opinion on WHEN it runs, only what happens each time it does.
 *
 * The only supported non-NONE strategy is REASSIGN_TO_ASSIGNEE_MANAGER:
 * resolves the current assignee's manager via Organisation (never a
 * duplicated reporting-line lookup) and reassigns the task to them. If no
 * manager can be resolved, the task is still marked escalated (a durable,
 * auditable fact) with no reassignment — never a silent security bypass,
 * per the same "no eligible approver -> explicit failure, never insecure
 * fallback" principle as routing (PR brief item 15).
 */
import type { WorkflowTaskRepository, WorkflowInstanceRepository, WorkflowTransaction } from "../repositories/types.ts";
import type { RbacService } from "../../../identity/src/services/rbacService.ts";
import type { UserRepository } from "../../../identity/src/repositories/types.ts";
import type { EmploymentAssignmentService } from "../../../organisation/src/services/employmentAssignmentService.ts";
import { ForbiddenError } from "../../../identity/src/domain/errors.ts";
import { PERMISSIONS, type ActorContext } from "./access.ts";

export function createEscalationService(deps: {
  tasks: WorkflowTaskRepository;
  instances: WorkflowInstanceRepository;
  users: UserRepository;
  orgAssignments: Pick<EmploymentAssignmentService, "resolveDirectManagerUserId">;
  rbac: RbacService;
  transactions: WorkflowTransaction;
}) {
  return {
    async processDueEscalations(actor: ActorContext): Promise<{ processed: number; reassigned: number }> {
      const access = await deps.rbac.authorize({ userId: actor.userId, permissionKey: PERMISSIONS.OPERATION_PROCESS_ESCALATIONS });
      if (!access.allowed) throw new ForbiddenError(PERMISSIONS.OPERATION_PROCESS_ESCALATIONS);

      const due = await deps.tasks.listDueForEscalation(new Date().toISOString());
      let reassigned = 0;
      let processed = 0;

      for (const task of due) {
        let target: string | null = null;
        if (task.escalationTargetMode === "REASSIGN_TO_ASSIGNEE_MANAGER" && task.assignedUserId) {
          const link = await deps.users.findActiveLinkByUserId(task.assignedUserId);
          if (link) target = await deps.orgAssignments.resolveDirectManagerUserId(link.employeeId);
        }

        await deps.transactions.run(async (repos) => {
          const escalated = await repos.tasks.markEscalated(task.id, { assignedUserId: target ?? undefined });
          if (!escalated) return; // a concurrent sweep already escalated this task
          processed++;
          const instance = await repos.instances.findById(task.instanceId);
          if (!instance) return;
          await repos.events.append({ instanceId: instance.id, eventType: "escalation_triggered", eventData: { taskId: task.id, reassignedTo: target }, recordedBy: null });
          if (target) {
            reassigned++;
            await repos.events.append({ instanceId: instance.id, eventType: "task_reassigned", eventData: { taskId: task.id, assignedUserId: target, reason: "escalation" }, recordedBy: null });
          }
        });
      }

      return { processed, reassigned };
    },
  };
}

export type EscalationService = ReturnType<typeof createEscalationService>;
