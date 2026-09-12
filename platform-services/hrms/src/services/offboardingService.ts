/**
 * Offboarding — neutral, jurisdiction-agnostic separation process. No
 * Malaysian/Singapore termination-law calculations, no final-salary/
 * notice-pay/statutory-severance computation anywhere in this file (PR
 * brief item 10) — those require future jurisdiction/payroll/legal-policy
 * layers this foundation deliberately does not build.
 *
 * Employment ended ≠ Identity record deleted (item 11). Completing an
 * offboarding case: (1) ends the authoritative employment assignment
 * through Organisation, (2) updates the case's own lifecycle/outcome, and
 * (3) records an `identity_deactivation_requested` EVENT — it never calls
 * any Identity mutation API and never deletes anything. Actually
 * orchestrating that follow-up action is left to a human administrator or
 * a future Workflow/Approval service; this establishes the safe boundary
 * (a durable, auditable request) without performing the deactivation
 * itself. See docs/architecture/hrms-employee-lifecycle.md "Offboarding
 * consistency with Employee Master and Identity".
 */
import type { LifecycleCaseService } from "./lifecycleCaseService.ts";
import type { LifecycleCaseRepository } from "../repositories/types.ts";
import { PERMISSIONS, checkAccess, baseCeiling, type ActorContext } from "./access.ts";
import type { RbacService } from "../../../identity/src/services/rbacService.ts";
import type { OrganisationRepository } from "../../../identity/src/repositories/types.ts";
import type { EmploymentAssignmentService } from "../../../organisation/src/services/employmentAssignmentService.ts";
import type { EmploymentAssignment } from "../../../organisation/src/domain/employee.ts";
import { ForbiddenError } from "../../../identity/src/domain/errors.ts";
import { NotFoundError, ValidationError } from "../domain/errors.ts";
import type { HrLifecycleCase, CreateMilestoneInput, HrLifecycleMilestone, MilestoneStatus } from "../domain/lifecycle.ts";

export function createOffboardingService(deps: {
  lifecycle: LifecycleCaseService;
  cases: LifecycleCaseRepository;
  organisation: OrganisationRepository;
  rbac: RbacService;
  orgAssignments: EmploymentAssignmentService;
}) {
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
     * then completes the case and records an identity-deactivation
     * REQUEST event. Never deletes or disables the Identity account
     * itself. Same two-phase, no-false-completion transaction boundary as
     * employmentChangeService.completeChange — see this file's header.
     */
    async completeOffboarding(actor: ActorContext, caseId: string, input: { endDate: string; status: "TERMINATED" | "RESIGNED"; changeReason?: string }): Promise<{ case: HrLifecycleCase; assignment: EmploymentAssignment }> {
      const hrCase = await deps.cases.findById(caseId);
      if (!hrCase) throw new NotFoundError("Lifecycle case");
      if (hrCase.lifecycleType !== "offboarding") throw new ValidationError("This case is not an offboarding case.");

      const legalEntity = await deps.organisation.findLegalEntityById(hrCase.legalEntityId);
      if (!legalEntity) throw new ValidationError("Case's legalEntityId does not refer to a known legal entity.");
      const ceiling = baseCeiling(legalEntity);
      const access = await checkAccess(deps.rbac, actor.userId, PERMISSIONS.MANAGE_OFFBOARDING, PERMISSIONS.MANAGE_OFFBOARDING_PRIVILEGED, { legalEntityId: hrCase.legalEntityId, recordClassification: ceiling });
      if (!access.allowed) throw new ForbiddenError(PERMISSIONS.MANAGE_OFFBOARDING);

      // Authoritative first — if this throws, the case remains untouched.
      const assignment = await deps.orgAssignments.endAssignment(actor, hrCase.employeeId, { endDate: input.endDate, status: input.status, changeReason: input.changeReason });

      const updated = await deps.lifecycle.transitionCase(
        actor,
        caseId,
        { base: PERMISSIONS.MANAGE_OFFBOARDING, privileged: PERMISSIONS.MANAGE_OFFBOARDING_PRIVILEGED },
        { status: "COMPLETED", outcome: input.status, effectiveDate: input.endDate, resultingAssignmentId: assignment.id, currentStage: "separated" },
        { type: "separation_effective", data: { status: input.status, endDate: input.endDate }, notes: input.changeReason ?? null },
        async (repos) => {
          // A durable, auditable REQUEST — never an actual Identity
          // mutation. See this file's header comment.
          await repos.events.append({ caseId, eventType: "identity_deactivation_requested", eventData: { employeeId: hrCase.employeeId }, recordedBy: actor.userId });
        },
      );
      return { case: updated, assignment };
    },
  };
}

export type OffboardingService = ReturnType<typeof createOffboardingService>;
