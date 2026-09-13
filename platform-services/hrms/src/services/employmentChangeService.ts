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
 * "Transaction boundaries" for the full reasoning): completion runs
 * through lifecycleCaseService.completeCaseWithAuthoritativeWrite, which
 * binds Organisation's createAssignment() to the SAME Postgres transaction
 * as this case's own completion write — one shared BEGIN/COMMIT, not two
 * sequential ones. If either step throws, both roll back together: the
 * case is never left saying COMPLETED while the authoritative change
 * failed, and Organisation never keeps a change whose HR case failed to
 * complete.
 */
import type { LifecycleCaseService } from "./lifecycleCaseService.ts";
import { PERMISSIONS, type ActorContext } from "./access.ts";
import type { CreateAssignmentInput, EmploymentAssignment } from "../../../organisation/src/domain/employee.ts";
import { ValidationError } from "../domain/errors.ts";
import type { HrLifecycleCase } from "../domain/lifecycle.ts";

export function createEmploymentChangeService(deps: { lifecycle: LifecycleCaseService }) {
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
     * Runs Organisation's createAssignment() and this case's own
     * completion write as ONE shared Postgres transaction (see this
     * file's header). `assignmentInput` is passed through to
     * Organisation's own createAssignment() unmodified — this service
     * does not reinterpret or duplicate its validation.
     */
    async completeChange(actor: ActorContext, caseId: string, assignmentInput: CreateAssignmentInput): Promise<{ case: HrLifecycleCase; assignment: EmploymentAssignment }> {
      const { case: updated, result: assignment } = await deps.lifecycle.completeCaseWithAuthoritativeWrite(
        actor,
        caseId,
        "employment_change",
        { base: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, privileged: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE_PRIVILEGED },
        async (lockedCase, scopedAssignments) => scopedAssignments.createAssignment(actor, lockedCase.employeeId, assignmentInput),
        (lockedCase, assignment) => ({
          target: { outcome: lockedCase.caseSubtype, effectiveDate: assignment.effectiveFrom, resultingAssignmentId: assignment.id },
          event: { type: "employment_change_completed", data: { assignmentId: assignment.id } },
        }),
        async (repos, lockedCase) => {
          await repos.events.append({ caseId, eventType: "employment_change_authorised", eventData: { changeType: lockedCase.caseSubtype }, recordedBy: actor.userId });
        },
      );
      return { case: updated, assignment };
    },
  };
}

export type EmploymentChangeService = ReturnType<typeof createEmploymentChangeService>;
