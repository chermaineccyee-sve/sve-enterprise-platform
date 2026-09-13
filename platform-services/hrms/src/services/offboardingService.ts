/**
 * Offboarding — neutral, jurisdiction-agnostic separation process. No
 * Malaysian/Singapore termination-law calculations, no final-salary/
 * notice-pay/statutory-severance computation anywhere in this file (PR
 * brief item 10) — those require future jurisdiction/payroll/legal-policy
 * layers this foundation deliberately does not build.
 *
 * Employment ended ≠ Identity record deleted (item 11). Completing an
 * offboarding case runs, as ONE shared Postgres transaction (via
 * lifecycleCaseService.completeCaseWithAuthoritativeWrite — see docs/
 * architecture/hrms-employee-lifecycle.md "Transaction boundaries"): (1)
 * ends the authoritative employment assignment through Organisation, (2)
 * updates the case's own lifecycle/outcome, (3) records an
 * `identity_deactivation_requested` EVENT, and (4, PR #10) — if the
 * employee has a currently-linked, active Identity user — inserts a
 * durable `hr_identity_deactivation_requests` row in the SAME transaction,
 * so a committed request event never exists without a corresponding
 * durable row to process (see docs/architecture/identity-offboarding-
 * revocation.md "Deactivation request lifecycle"). This file still never
 * calls any Identity mutation API and never deletes anything — actual
 * revocation is `integrations/identityDeactivationProcessor.ts`'s job, a
 * deliberately separate, later, independently-retryable step (PR #10
 * §13/§14), not part of this transaction.
 */
import type { LifecycleCaseService } from "./lifecycleCaseService.ts";
import { PERMISSIONS, type ActorContext } from "./access.ts";
import type { EmploymentAssignment } from "../../../organisation/src/domain/employee.ts";
import type { UserRepository } from "../../../identity/src/repositories/types.ts";
import { ValidationError } from "../domain/errors.ts";
import type { HrLifecycleCase, CreateMilestoneInput, HrLifecycleMilestone, MilestoneStatus } from "../domain/lifecycle.ts";

export function createOffboardingService(deps: { lifecycle: LifecycleCaseService; users: UserRepository }) {
  return {
    async createOffboardingCase(
      actor: ActorContext,
      input: {
        employeeId: string;
        legalEntityId: string;
        hrOwnerUserId: string;
        separationType: string;
        reasonCategory?: string | null;
        noticeDate?: string | null;
        intendedLastWorkingDate?: string | null;
        clearanceMilestones?: string[];
      },
    ): Promise<HrLifecycleCase> {
      if (!input.separationType?.trim()) throw new ValidationError("separationType is required.");
      return deps.lifecycle.createCase(
        actor,
        {
          employeeId: input.employeeId,
          legalEntityId: input.legalEntityId,
          lifecycleType: "offboarding",
          caseSubtype: input.separationType,
          hrOwnerUserId: input.hrOwnerUserId,
          reasonCategory: input.reasonCategory ?? null,
          currentStage: "notice",
          noticeDate: input.noticeDate ?? null,
          intendedLastWorkingDate: input.intendedLastWorkingDate ?? null,
        },
        { data: { separationType: input.separationType } },
        async (repos, created) => {
          for (const milestoneType of input.clearanceMilestones ?? []) {
            await repos.milestones.create(created.id, { milestoneType });
          }
          await repos.events.append({ caseId: created.id, eventType: "offboarding_initiated", eventData: { separationType: input.separationType }, recordedBy: actor.userId });
          await repos.cases.updateStatus(created.id, { status: "IN_PROGRESS", updatedBy: actor.userId });
        },
      );
    },

    async addClearanceMilestone(actor: ActorContext, caseId: string, input: CreateMilestoneInput): Promise<HrLifecycleMilestone> {
      return deps.lifecycle.addMilestone(actor, caseId, { base: PERMISSIONS.MANAGE_OFFBOARDING, privileged: PERMISSIONS.MANAGE_OFFBOARDING_PRIVILEGED }, input);
    },

    async updateClearanceMilestone(actor: ActorContext, caseId: string, milestoneId: string, input: { status: MilestoneStatus; notes?: string | null }): Promise<HrLifecycleMilestone> {
      return deps.lifecycle.updateMilestone(actor, caseId, milestoneId, { base: PERMISSIONS.MANAGE_OFFBOARDING, privileged: PERMISSIONS.MANAGE_OFFBOARDING_PRIVILEGED }, input);
    },

    /**
     * Ends the authoritative employment assignment through Organisation,
     * completes the case, and records an identity-deactivation REQUEST
     * event — all as ONE shared Postgres transaction (see this file's
     * header). Never deletes or disables the Identity account itself.
     */
    async completeOffboarding(
      actor: ActorContext,
      caseId: string,
      input: { endDate: string; status: "TERMINATED" | "RESIGNED"; changeReason?: string },
      executionContext?: { decisionActorUserId: string | null; initiatedBySystem: string | null },
    ): Promise<{ case: HrLifecycleCase; assignment: EmploymentAssignment }> {
      if (!input.endDate) throw new ValidationError("endDate is required.");
      const { case: updated, result: assignment } = await deps.lifecycle.completeCaseWithAuthoritativeWrite(
        actor,
        caseId,
        "offboarding",
        { base: PERMISSIONS.MANAGE_OFFBOARDING, privileged: PERMISSIONS.MANAGE_OFFBOARDING_PRIVILEGED },
        async (lockedCase, scopedAssignments) => scopedAssignments.endAssignment(actor, lockedCase.employeeId, { endDate: input.endDate, status: input.status, changeReason: input.changeReason }),
        (_lockedCase, assignment) => ({
          target: { outcome: input.status, effectiveDate: input.endDate, resultingAssignmentId: assignment.id, currentStage: "separated" },
          event: { type: "separation_effective", data: { status: input.status, endDate: input.endDate }, notes: input.changeReason ?? null },
        }),
        async (repos, lockedCase) => {
          // A durable, auditable REQUEST — never an actual Identity
          // mutation. See this file's header comment.
          await repos.events.append({ caseId, eventType: "identity_deactivation_requested", eventData: { employeeId: lockedCase.employeeId }, recordedBy: actor.userId });

          // PR #10: the durable request row the processor consumes,
          // created atomically alongside the event above. Only when the
          // employee currently has an ACTIVE Identity link — a contractor
          // or employee who never had an Identity account has nothing to
          // revoke, and this deliberately never creates a request with no
          // real target.
          const link = await deps.users.findActiveLinkByEmployeeId(lockedCase.employeeId);
          if (link) {
            await repos.deactivationRequests.create({ caseId, employeeId: lockedCase.employeeId, targetUserId: link.userId, requestedBy: actor.userId, reasonCategory: "hrms_offboarding" });
          }
        },
        executionContext,
      );
      return { case: updated, assignment };
    },
  };
}

export type OffboardingService = ReturnType<typeof createOffboardingService>;
