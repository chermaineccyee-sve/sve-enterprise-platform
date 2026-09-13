/**
 * Onboarding — the thinnest of the four lifecycle types: a case plus a
 * checklist of milestones (documentation/policy-acknowledgement/employee-
 * information/reporting-line-confirmation/system-access-request/
 * equipment/induction/approvals/completion — PR brief item 6's candidate
 * list, not mechanically implemented as a fixed set: callers supply
 * whatever milestoneType values suit the case). This is NOT a workflow
 * engine — see docs/architecture/hrms-employee-lifecycle.md "Onboarding"
 * for the documented boundary with the future platform-services/workflow
 * service.
 */
import type { LifecycleCaseService } from "./lifecycleCaseService.ts";
import { PERMISSIONS, type ActorContext } from "./access.ts";
import { assertValidTransition } from "../domain/stateMachine.ts";
import type { HrLifecycleCase, HrLifecycleMilestone, CreateMilestoneInput } from "../domain/lifecycle.ts";

export function createOnboardingService(deps: { lifecycle: LifecycleCaseService }) {
  return {
    async createOnboardingCase(
      actor: ActorContext,
      input: { employeeId: string; legalEntityId: string; hrOwnerUserId: string; currentStage?: string | null; initialMilestones?: string[] },
    ): Promise<HrLifecycleCase> {
      return deps.lifecycle.createCase(
        actor,
        { employeeId: input.employeeId, legalEntityId: input.legalEntityId, lifecycleType: "onboarding", hrOwnerUserId: input.hrOwnerUserId, currentStage: input.currentStage ?? null },
        { data: { initialMilestones: input.initialMilestones ?? [] } },
        async (repos, created) => {
          for (const milestoneType of input.initialMilestones ?? []) {
            await repos.milestones.create(created.id, { milestoneType });
          }
          assertValidTransition("DRAFT", "IN_PROGRESS");
          await repos.cases.updateStatus(created.id, { status: "IN_PROGRESS", updatedBy: actor.userId });
        },
      );
    },

    async addMilestone(actor: ActorContext, caseId: string, input: CreateMilestoneInput): Promise<HrLifecycleMilestone> {
      return deps.lifecycle.addMilestone(actor, caseId, { base: PERMISSIONS.MANAGE_ONBOARDING, privileged: PERMISSIONS.MANAGE_ONBOARDING_PRIVILEGED }, input);
    },

    async completeMilestone(actor: ActorContext, caseId: string, milestoneId: string, notes?: string | null): Promise<HrLifecycleMilestone> {
      return deps.lifecycle.updateMilestone(actor, caseId, milestoneId, { base: PERMISSIONS.MANAGE_ONBOARDING, privileged: PERMISSIONS.MANAGE_ONBOARDING_PRIVILEGED }, { status: "COMPLETED", notes });
    },

    /** All milestones done (or intentionally skipped) — close the case. Uses the generic `complete` permission (see lifecycleCaseService.completeCase), since onboarding has no separate "decision" concept the way probation does. */
    async completeOnboarding(actor: ActorContext, caseId: string): Promise<HrLifecycleCase> {
      return deps.lifecycle.completeCase(actor, caseId, { outcome: "onboarded" });
    },
  };
}

export type OnboardingService = ReturnType<typeof createOnboardingService>;
