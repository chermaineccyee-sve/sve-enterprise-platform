/**
 * The shared sequential-routing engine (PR brief item 11: sequential
 * execution, not arbitrary DAG/parallel branches). Every function here
 * takes an explicit `repos: WorkflowTxRepos` parameter rather than
 * closing over one fixed transaction, so BOTH instanceService's
 * startWorkflow (activating step 1) and taskService's decide/completeTask
 * (activating step N+1, or completing the instance) can invoke the same
 * logic from inside their OWN transaction — see docs/architecture/
 * workflow-approval-foundation.md "Instances" and "Actor resolution".
 */
import type { WorkflowTxRepos } from "../repositories/types.ts";
import type { OrganisationRepository, UserRepository } from "../../../identity/src/repositories/types.ts";
import type { EmploymentAssignmentService } from "../../../organisation/src/services/employmentAssignmentService.ts";
import type { SystemActionRegistry } from "../domain/systemActionRegistry.ts";
import type { WorkflowInstance, WorkflowStep, ApprovalDecisionType } from "../domain/workflow.ts";
import { InvalidStateError } from "../domain/errors.ts";

type Resolution = { ok: true; assignedUserId: string | null; assignedPermissionKey: string | null } | { ok: false; reason: string };

export function createInstanceEngine(deps: { organisation: OrganisationRepository; users: UserRepository; orgAssignments: Pick<EmploymentAssignmentService, "resolveDirectManagerUserId">; systemActions: SystemActionRegistry }) {
  /**
   * Resolved at STEP-ACTIVATION time, not instance-start time (PR brief
   * item 14): reporting relationships may change during a long-running
   * workflow, so MANAGER routing always re-resolves fresh against
   * Organisation's current data when the step actually activates.
   */
  async function resolveAssignment(step: WorkflowStep, instance: WorkflowInstance): Promise<Resolution> {
    if (step.assignmentMode === "MANAGER") {
      if (!instance.subjectEmployeeId) return { ok: false, reason: "MANAGER routing requires the instance to carry a subjectEmployeeId." };
      const managerUserId = await deps.orgAssignments.resolveDirectManagerUserId(instance.subjectEmployeeId);
      if (!managerUserId) return { ok: false, reason: "No current manager could be resolved for the subject employee." };
      if (!step.allowSelfApproval && instance.subjectActorUserId && managerUserId === instance.subjectActorUserId) {
        return { ok: false, reason: "The resolved manager is the workflow's own subject actor; self-approval is not permitted for this step." };
      }
      return { ok: true, assignedUserId: managerUserId, assignedPermissionKey: null };
    }
    if (step.assignmentMode === "ROLE") {
      // Eligibility is NOT materialised into a user list here — it is
      // checked live, against assignedPermissionKey, at decision time
      // (see taskService.ts). This is a documented limitation: a ROLE
      // step can activate with zero currently-eligible approvers without
      // that being caught as a routing failure — see docs "Remaining
      // risks".
      return { ok: true, assignedUserId: null, assignedPermissionKey: step.assignedPermissionKey };
    }
    // USER mode: the caller supplied an explicit target at instance-start
    // time (stored in instance.context.stepAssignments), since a
    // definition never hard-codes a specific person.
    const stepAssignments = (instance.context as { stepAssignments?: Record<string, { userId?: string }> } | null)?.stepAssignments;
    const userId = stepAssignments?.[String(step.sequenceNumber)]?.userId ?? null;
    if (!userId) return { ok: false, reason: "USER routing requires an explicit stepAssignments entry (by sequenceNumber) supplied when the workflow was started." };
    if (!step.allowSelfApproval && instance.subjectActorUserId && userId === instance.subjectActorUserId) {
      return { ok: false, reason: "The assigned user is the workflow's own subject actor; self-approval is not permitted for this step." };
    }
    return { ok: true, assignedUserId: userId, assignedPermissionKey: null };
  }

  function addMinutes(minutes: number | null): string | null {
    if (minutes === null) return null;
    return new Date(Date.now() + minutes * 60_000).toISOString();
  }

  /** Activates `step` for `instance`: creates a task (APPROVAL/TASK) or synchronously runs a registered handler (SYSTEM_ACTION), advancing automatically on success. Always returns the instance's current row after this activation attempt. */
  async function activateStep(repos: WorkflowTxRepos, instance: WorkflowInstance, step: WorkflowStep, recordedBy: string | null): Promise<WorkflowInstance> {
    await repos.events.append({ instanceId: instance.id, eventType: "step_activated", eventData: { stepId: step.id, sequenceNumber: step.sequenceNumber, stepType: step.stepType }, recordedBy });

    if (step.stepType === "SYSTEM_ACTION") {
      return executeSystemActionStep(repos, instance, step, recordedBy);
    }

    const resolution = await resolveAssignment(step, instance);
    if (!resolution.ok) {
      await repos.events.append({ instanceId: instance.id, eventType: "routing_failed", eventData: { stepId: step.id }, notes: resolution.reason, recordedBy });
      return repos.instances.updateProgress(instance.id, { status: "FAILED", currentStepId: step.id, failureCategory: "ROUTING_FAILURE" });
    }

    const task = await repos.tasks.create({
      instanceId: instance.id,
      stepId: step.id,
      taskType: step.stepType === "APPROVAL" ? "APPROVAL" : "TASK",
      assignmentMode: step.assignmentMode!,
      assignedUserId: resolution.assignedUserId,
      assignedPermissionKey: resolution.assignedPermissionKey,
      dueAt: addMinutes(step.dueAfterMinutes),
      escalateAfter: addMinutes(step.escalateAfterMinutes),
      escalationTargetMode: step.escalationTargetMode,
    });
    await repos.events.append({ instanceId: instance.id, eventType: "task_created", eventData: { taskId: task.id, stepId: step.id, assignmentMode: step.assignmentMode }, recordedBy });
    return repos.instances.updateProgress(instance.id, { status: "ACTIVE", currentStepId: step.id });
  }

  async function executeSystemActionStep(repos: WorkflowTxRepos, instance: WorkflowInstance, step: WorkflowStep, recordedBy: string | null): Promise<WorkflowInstance> {
    const { execution } = await repos.systemActions.findOrCreate({ instanceId: instance.id, stepId: step.id, handlerKey: step.systemActionHandlerKey! });

    if (execution.status === "SUCCEEDED") {
      // Idempotent replay of an already-succeeded activation (e.g. a
      // retried request) — proceed as if it just succeeded, never
      // re-running the handler.
      return advancePastStep(repos, instance, step, recordedBy);
    }
    if (execution.status === "FAILED") {
      return repos.instances.updateProgress(instance.id, { status: "FAILED", currentStepId: step.id, failureCategory: "SYSTEM_ACTION_FAILURE" });
    }

    try {
      await deps.systemActions.execute(step.systemActionHandlerKey!, { instance, step });
      await repos.systemActions.updateStatus(execution.id, { status: "SUCCEEDED", attempts: execution.attempts + 1 });
      await repos.events.append({ instanceId: instance.id, eventType: "system_action_executed", eventData: { stepId: step.id, handlerKey: step.systemActionHandlerKey }, recordedBy });
      return advancePastStep(repos, instance, step, recordedBy);
    } catch (error) {
      // Single attempt per activation in this foundation — no automatic
      // retry loop (PR brief item 22: avoid infinite automatic retries).
      // `attempts` is persisted so a future PR can add bounded retry
      // logic without a schema change.
      const message = error instanceof Error ? error.message : String(error);
      await repos.systemActions.updateStatus(execution.id, { status: "FAILED", attempts: execution.attempts + 1, lastError: message });
      await repos.events.append({ instanceId: instance.id, eventType: "system_action_failed", eventData: { stepId: step.id, handlerKey: step.systemActionHandlerKey }, notes: message, recordedBy });
      return repos.instances.updateProgress(instance.id, { status: "FAILED", currentStepId: step.id, failureCategory: "SYSTEM_ACTION_FAILURE" });
    }
  }

  async function advancePastStep(repos: WorkflowTxRepos, instance: WorkflowInstance, completedStep: WorkflowStep, recordedBy: string | null, outcome?: string): Promise<WorkflowInstance> {
    await repos.events.append({ instanceId: instance.id, eventType: "step_completed", eventData: { stepId: completedStep.id }, recordedBy });
    const allSteps = await repos.steps.listByVersion(instance.versionId);
    const next = allSteps.find((s) => s.sequenceNumber === completedStep.sequenceNumber + 1);
    if (!next) {
      const finalOutcome = outcome ?? "COMPLETED";
      await repos.events.append({ instanceId: instance.id, eventType: "instance_completed", eventData: { outcome: finalOutcome }, recordedBy });
      return repos.instances.updateProgress(instance.id, { status: "COMPLETED", currentStepId: null, outcome: finalOutcome });
    }
    return activateStep(repos, instance, next, recordedBy);
  }

  async function completeAsRejected(repos: WorkflowTxRepos, instance: WorkflowInstance, recordedBy: string | null): Promise<WorkflowInstance> {
    await repos.events.append({ instanceId: instance.id, eventType: "instance_completed", eventData: { outcome: "REJECTED" }, recordedBy });
    return repos.instances.updateProgress(instance.id, { status: "COMPLETED", currentStepId: null, outcome: "REJECTED" });
  }

  async function returnToPreviousStep(repos: WorkflowTxRepos, instance: WorkflowInstance, currentStep: WorkflowStep, recordedBy: string | null): Promise<WorkflowInstance> {
    const allSteps = await repos.steps.listByVersion(instance.versionId);
    const prev = allSteps.find((s) => s.sequenceNumber === currentStep.sequenceNumber - 1);
    if (!prev) throw new InvalidStateError("Cannot RETURN from the first step of a workflow.");
    return activateStep(repos, instance, prev, recordedBy);
  }

  /** Applies an APPROVAL decision's effect: REJECT always completes the instance; RETURN reactivates the previous step; APPROVE advances to the next step or completes the instance if this was the last one. */
  async function applyDecisionTransition(
    repos: WorkflowTxRepos,
    instance: WorkflowInstance,
    step: WorkflowStep,
    decision: ApprovalDecisionType,
    recordedBy: string,
  ): Promise<{ instance: WorkflowInstance; resultingTransition: string }> {
    if (decision === "REJECT") {
      return { instance: await completeAsRejected(repos, instance, recordedBy), resultingTransition: "instance_completed:REJECTED" };
    }
    if (decision === "RETURN") {
      const updated = await returnToPreviousStep(repos, instance, step, recordedBy);
      return { instance: updated, resultingTransition: `returned_to_step_${step.sequenceNumber - 1}` };
    }
    const allSteps = await repos.steps.listByVersion(instance.versionId);
    const isLast = step.sequenceNumber === Math.max(...allSteps.map((s) => s.sequenceNumber));
    const updated = await advancePastStep(repos, instance, step, recordedBy, isLast ? "APPROVED" : undefined);
    return { instance: updated, resultingTransition: isLast ? "instance_completed:APPROVED" : `advanced_to_step_${step.sequenceNumber + 1}` };
  }

  /** Applies a plain TASK step's completion — always advances, like an implicit approval, but never writes a workflow_decisions row (TASK steps carry no approve/reject dimension). */
  async function applyTaskCompletion(repos: WorkflowTxRepos, instance: WorkflowInstance, step: WorkflowStep, recordedBy: string): Promise<WorkflowInstance> {
    return advancePastStep(repos, instance, step, recordedBy);
  }

  return { resolveAssignment, activateStep, applyDecisionTransition, applyTaskCompletion };
}

export type InstanceEngine = ReturnType<typeof createInstanceEngine>;
