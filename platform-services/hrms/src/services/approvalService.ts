/**
 * HRMS <-> Workflow integration, HRMS side (PR #9). Owns the decision of
 * WHEN and HOW an HRMS lifecycle case enters the approval workflow —
 * never how Workflow itself routes/decides, which stays entirely inside
 * platform-services/workflow. Depends only on the minimal
 * WorkflowSubmissionPort (see workflowPort.ts), never a concrete Workflow
 * type — the concrete adapter lives in
 * platform-services/hrms/src/integrations/workflowIntegration.ts. See
 * docs/architecture/hrms-workflow-integration.md.
 *
 * Only `employment_change` and `offboarding` cases go through this path
 * in this foundation — onboarding/probation completion remains manual,
 * via their own existing operations, entirely unaffected by this file.
 */
import type { LifecycleCaseRepository, LifecycleTransaction } from "../repositories/types.ts";
import type { RbacService } from "../../../identity/src/services/rbacService.ts";
import type { AuditService } from "../../../identity/src/services/auditService.ts";
import type { OrganisationRepository } from "../../../identity/src/repositories/types.ts";
import type { LifecycleCaseService } from "./lifecycleCaseService.ts";
import type { WorkflowSubmissionPort } from "./workflowPort.ts";
import { ForbiddenError } from "../../../identity/src/domain/errors.ts";
import { NotFoundError, ValidationError, InvalidTransitionError } from "../domain/errors.ts";
import { assertValidTransition } from "../domain/stateMachine.ts";
import type { HrLifecycleCase, LifecycleType } from "../domain/lifecycle.ts";
import { PERMISSIONS, checkAccess, baseCeiling, type ActorContext } from "./access.ts";

const SUBMITTABLE_TYPES = new Set<LifecycleType>(["employment_change", "offboarding"]);

export const DEFINITION_KEY_BY_TYPE: Record<"employment_change" | "offboarding", string> = {
  employment_change: "hrms.employment_change",
  offboarding: "hrms.offboarding",
};

const SUBMIT_PERMISSION_BY_TYPE: Record<"employment_change" | "offboarding", { base: string; privileged: string }> = {
  employment_change: { base: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, privileged: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE_PRIVILEGED },
  offboarding: { base: PERMISSIONS.MANAGE_OFFBOARDING, privileged: PERMISSIONS.MANAGE_OFFBOARDING_PRIVILEGED },
};

function validateCompletionInput(lifecycleType: "employment_change" | "offboarding", input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") throw new ValidationError("completionInput is required.");
  const i = input as Record<string, unknown>;
  if (lifecycleType === "employment_change") {
    if (typeof i.employmentType !== "string" || !i.employmentType.trim()) throw new ValidationError("completionInput.employmentType is required.");
    if (typeof i.status !== "string" || !i.status.trim()) throw new ValidationError("completionInput.status is required.");
    if (typeof i.startDate !== "string" || !i.startDate.trim()) throw new ValidationError("completionInput.startDate is required.");
  } else {
    if (typeof i.endDate !== "string" || !i.endDate.trim()) throw new ValidationError("completionInput.endDate is required.");
    if (i.status !== "TERMINATED" && i.status !== "RESIGNED") throw new ValidationError("completionInput.status must be 'TERMINATED' or 'RESIGNED'.");
  }
  return i;
}

export function createApprovalService(deps: {
  cases: LifecycleCaseRepository;
  organisation: OrganisationRepository;
  rbac: RbacService;
  audit: AuditService;
  transactions: LifecycleTransaction;
  lifecycle: Pick<LifecycleCaseService, "resolveAccess">;
  workflow: WorkflowSubmissionPort;
}) {
  async function requireSubmitPermission(actor: ActorContext, hrCase: HrLifecycleCase, permission: { base: string; privileged: string }): Promise<void> {
    const legalEntity = await deps.organisation.findLegalEntityById(hrCase.legalEntityId);
    if (!legalEntity) throw new ValidationError("Case's legalEntityId does not refer to a known legal entity.");
    const ceiling = baseCeiling(legalEntity);
    const access = await checkAccess(deps.rbac, actor.userId, permission.base, permission.privileged, { legalEntityId: hrCase.legalEntityId, recordClassification: ceiling });
    if (!access.allowed) throw new ForbiddenError(permission.base);
  }

  return {
    /**
     * Idempotent, retry-safe two-phase submission (see docs "HRMS <->
     * Workflow linkage" for the full reasoning this design follows):
     * Phase 1 transitions the case IN_PROGRESS -> PENDING_DECISION under
     * a row lock (the SAME concurrency-safety mechanism
     * completeCaseWithAuthoritativeWrite uses) and durably records the
     * completion terms this approval will apply; Phase 2 starts the
     * Workflow instance and links it. A retry after a Phase-2 failure
     * (case left at PENDING_DECISION with workflowInstanceId still null)
     * safely resumes at Phase 2 without repeating Phase 1 or creating a
     * second Workflow instance.
     */
    async submitForApproval(actor: ActorContext, caseId: string, completionInput: unknown): Promise<{ case: HrLifecycleCase; workflowInstanceId: string }> {
      const hrCase = await deps.cases.findById(caseId);
      if (!hrCase) throw new NotFoundError("Lifecycle case");
      if (!SUBMITTABLE_TYPES.has(hrCase.lifecycleType)) throw new ValidationError(`${hrCase.lifecycleType} cases are not submitted for Workflow approval in this foundation.`);
      const lifecycleType = hrCase.lifecycleType as "employment_change" | "offboarding";

      await requireSubmitPermission(actor, hrCase, SUBMIT_PERMISSION_BY_TYPE[lifecycleType]);

      const alreadyLinked = hrCase.status === "PENDING_DECISION" && hrCase.workflowInstanceId;
      if (alreadyLinked) {
        // Safe no-op: this exact case has already been fully submitted.
        return { case: hrCase, workflowInstanceId: hrCase.workflowInstanceId! };
      }
      const resumable = hrCase.status === "PENDING_DECISION" && !hrCase.workflowInstanceId;
      if (hrCase.status !== "IN_PROGRESS" && !resumable) {
        throw new InvalidTransitionError(`Cannot submit a case in ${hrCase.status} status for approval.`);
      }

      const validatedInput = validateCompletionInput(lifecycleType, completionInput);
      const definitionKey = DEFINITION_KEY_BY_TYPE[lifecycleType];

      // Phase 1 — row-locked, idempotent no-op if a concurrent caller
      // already made this exact transition (Race A, brief §23).
      const locked = await deps.transactions.run(async (repos) => {
        const current = await repos.cases.findByIdForUpdate(caseId);
        if (!current) throw new NotFoundError("Lifecycle case");
        if (current.status === "PENDING_DECISION") return current; // a concurrent winner already transitioned it
        assertValidTransition(current.status, "PENDING_DECISION");
        const updated = await repos.cases.updateStatus(caseId, { status: "PENDING_DECISION", pendingCompletionInput: validatedInput, updatedBy: actor.userId });
        await repos.events.append({ caseId, eventType: "approval_submitted", eventData: { definitionKey }, recordedBy: actor.userId });
        return updated;
      });

      if (locked.workflowInstanceId) {
        // A concurrent winner already completed Phase 2 too.
        return { case: locked, workflowInstanceId: locked.workflowInstanceId };
      }

      // Phase 2 — start (or, under a genuine race, discover) the Workflow
      // instance, then link it. Workflow's own natural "at most one
      // ACTIVE instance per definition+subject" constraint is the
      // backstop if two callers both reach this phase concurrently (see
      // WorkflowSubmissionPort's doc comment).
      let workflowInstanceId: string;
      try {
        const submitted = await deps.workflow.submit(actor, { definitionKey, caseId, legalEntityId: hrCase.legalEntityId, employeeId: hrCase.employeeId });
        workflowInstanceId = submitted.workflowInstanceId;
      } catch (error) {
        const reconciled = await deps.cases.findById(caseId);
        if (reconciled?.workflowInstanceId) {
          // The concurrent winner's own Phase 2 already succeeded.
          return { case: reconciled, workflowInstanceId: reconciled.workflowInstanceId };
        }
        throw error;
      }

      const finalCase = await deps.cases.linkWorkflowInstance(caseId, workflowInstanceId);
      await deps.audit.record({ actorUserId: actor.userId, actorEmail: actor.email, action: "hrms.lifecycle.approval_submitted", resourceType: "hr_lifecycle_case", resourceId: caseId, legalEntityId: hrCase.legalEntityId, changeAfter: { workflowInstanceId } });
      return { case: finalCase, workflowInstanceId };
    },

    /**
     * Read-only, live status — never a cached copy of Workflow's own
     * state (see docs "HRMS <-> Workflow linkage": HRMS stores only the
     * reference). Also performs one-time, row-locked reconciliation when
     * the workflow outcome is REJECTED and this case has not yet been
     * reflected as such: the case returns to IN_PROGRESS (editable,
     * resubmittable) and an `approval_rejected` event is appended — a
     * clean terminate-and-resubmit model (brief §15/§16), never an
     * automatic CANCELLED.
     */
    async getApprovalStatus(actor: ActorContext, caseId: string): Promise<{ submitted: boolean; workflowInstanceId: string | null; status: string | null; outcome: string | null; visible: boolean }> {
      const hrCase = await deps.cases.findById(caseId);
      if (!hrCase) throw new NotFoundError("Lifecycle case");
      const { allowedBase } = await deps.lifecycle.resolveAccess(actor, hrCase);
      if (!allowedBase) throw new NotFoundError("Lifecycle case");

      if (!hrCase.workflowInstanceId) {
        return { submitted: false, workflowInstanceId: null, status: null, outcome: null, visible: true };
      }

      const live = await deps.workflow.getStatus(actor, hrCase.workflowInstanceId);
      if (!live) {
        return { submitted: true, workflowInstanceId: hrCase.workflowInstanceId, status: null, outcome: null, visible: false };
      }

      if (live.outcome === "REJECTED" && hrCase.status === "PENDING_DECISION") {
        await deps.transactions.run(async (repos) => {
          const current = await repos.cases.findByIdForUpdate(caseId);
          if (!current || current.status !== "PENDING_DECISION") return; // already reconciled by a concurrent caller
          await repos.cases.updateStatus(caseId, { status: "IN_PROGRESS", pendingCompletionInput: null, updatedBy: actor.userId });
          await repos.events.append({ caseId, eventType: "approval_rejected", eventData: { workflowInstanceId: hrCase.workflowInstanceId }, recordedBy: actor.userId });
        });
      }

      return { submitted: true, workflowInstanceId: hrCase.workflowInstanceId, status: live.status, outcome: live.outcome, visible: true };
    },
  };
}

export type ApprovalService = ReturnType<typeof createApprovalService>;
