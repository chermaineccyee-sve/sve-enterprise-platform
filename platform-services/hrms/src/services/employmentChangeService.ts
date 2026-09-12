/**
 * Employment change — represents the HR PROCESS and decision leading to a
 * change; platform-services/organisation remains the sole owner of
 * authoritative assignment-transition data (PR brief item 9). Completing
 * a case invokes Organisation's own createAssignment() — this file never
 * duplicates or bypasses its assignment integrity rules (effective-dating,
 * one-open-primary constraint, reporting-cycle checks, entity/permission
 * checks all remain enforced exactly as platform-services/organisation
 * already implements them).
 *
 * Transaction boundary (see docs/architecture/hrms-employee-lifecycle.md
 * "Transaction boundaries" for the full reasoning): Organisation's
 * createAssignment() runs its OWN real Postgres transaction, and
 * DatabaseProvider.transaction() does not support nesting — so this
 * service cannot wrap Organisation's write and its own case-completion
 * write in one shared ACID transaction. Instead: call Organisation FIRST;
 * only if it succeeds does this service commit the case's own completion
 * (status + resultingAssignmentId + events) in its OWN transaction. If
 * Organisation's call throws, this method propagates immediately and
 * writes nothing — the case is never left saying COMPLETED while the
 * authoritative change failed.
 */
import type { LifecycleCaseService } from "./lifecycleCaseService.ts";
import type { LifecycleCaseRepository } from "../repositories/types.ts";
import { PERMISSIONS, checkAccess, baseCeiling, type ActorContext } from "./access.ts";
import type { RbacService } from "../../../identity/src/services/rbacService.ts";
import type { OrganisationRepository } from "../../../identity/src/repositories/types.ts";
import type { EmploymentAssignmentService } from "../../../organisation/src/services/employmentAssignmentService.ts";
import type { CreateAssignmentInput, EmploymentAssignment } from "../../../organisation/src/domain/employee.ts";
import { ForbiddenError } from "../../../identity/src/domain/errors.ts";
import { NotFoundError, ValidationError } from "../domain/errors.ts";
import type { HrLifecycleCase } from "../domain/lifecycle.ts";

export function createEmploymentChangeService(deps: {
  lifecycle: LifecycleCaseService;
  cases: LifecycleCaseRepository;
  organisation: OrganisationRepository;
  rbac: RbacService;
  orgAssignments: EmploymentAssignmentService;
}) {
  return {
    async createChangeCase(
      actor: ActorContext,
      input: { employeeId: string; legalEntityId: string; hrOwnerUserId: string; changeType: string; reasonCategory?: string | null; proposedChangeSummary?: Record<string, unknown> },
    ): Promise<HrLifecycleCase> {
      if (!input.changeType?.trim()) throw new ValidationError("changeType is required.");
      return deps.lifecycle.createCase(
        actor,
        { employeeId: input.employeeId, legalEntityId: input.legalEntityId, lifecycleType: "employment_change", caseSubtype: input.changeType, hrOwnerUserId: input.hrOwnerUserId, reasonCategory: input.reasonCategory ?? null, currentStage: "proposed" },
        { data: { changeType: input.changeType, proposedChange: input.proposedChangeSummary ?? {} } },
        async (repos, created) => {
          await repos.cases.updateStatus(created.id, { status: "IN_PROGRESS", updatedBy: actor.userId });
        },
      );
    },

    /**
     * Executes the change through Organisation, then completes the case.
     * `assignmentInput` is passed through to Organisation's own
     * createAssignment() unmodified — this service does not reinterpret
     * or duplicate its validation.
     */
    async completeChange(actor: ActorContext, caseId: string, assignmentInput: CreateAssignmentInput): Promise<{ case: HrLifecycleCase; assignment: EmploymentAssignment }> {
      const hrCase = await deps.cases.findById(caseId);
      if (!hrCase) throw new NotFoundError("Lifecycle case");
      if (hrCase.lifecycleType !== "employment_change") throw new ValidationError("This case is not an employment-change case.");

      const legalEntity = await deps.organisation.findLegalEntityById(hrCase.legalEntityId);
      if (!legalEntity) throw new ValidationError("Case's legalEntityId does not refer to a known legal entity.");
      const ceiling = baseCeiling(legalEntity);
      const access = await checkAccess(deps.rbac, actor.userId, PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE_PRIVILEGED, { legalEntityId: hrCase.legalEntityId, recordClassification: ceiling });
      if (!access.allowed) throw new ForbiddenError(PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE);

      // Authoritative first: if this throws, nothing below runs and the
      // case is untouched (still IN_PROGRESS) — never falsely COMPLETED.
      const assignment = await deps.orgAssignments.createAssignment(actor, hrCase.employeeId, assignmentInput);

      const updated = await deps.lifecycle.transitionCase(
        actor,
        caseId,
        { base: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, privileged: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE_PRIVILEGED },
        { status: "COMPLETED", outcome: hrCase.caseSubtype, effectiveDate: assignment.effectiveFrom, resultingAssignmentId: assignment.id },
        { type: "employment_change_completed", data: { assignmentId: assignment.id } },
        async (repos) => {
          await repos.events.append({ caseId, eventType: "employment_change_authorised", eventData: { changeType: hrCase.caseSubtype }, recordedBy: actor.userId });
        },
      );
      return { case: updated, assignment };
    },
  };
}

export type EmploymentChangeService = ReturnType<typeof createEmploymentChangeService>;
