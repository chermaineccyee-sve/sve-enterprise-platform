/**
 * Probation — governs the HR process around probation without owning or
 * overwriting Employee Master's own employment-date/assignment concepts
 * (PR brief item 7). Confirmation and extension are DECISION OUTCOMES of
 * a probation review, not independent lifecycle types (item 5) — see
 * docs/architecture/hrms-employee-lifecycle.md "Probation / confirmation
 * / extension" for the reasoning.
 *
 * No universal probation duration is assumed anywhere in this file:
 * period_start/expected_review_date are always supplied by the caller.
 */
import type { LifecycleCaseService } from "./lifecycleCaseService.ts";
import type { LifecycleCaseRepository, ProbationReviewRepository } from "../repositories/types.ts";
import { PERMISSIONS, checkAccess, baseCeiling, type ActorContext } from "./access.ts";
import type { RbacService } from "../../../identity/src/services/rbacService.ts";
import type { AuditService } from "../../../identity/src/services/auditService.ts";
import type { OrganisationRepository } from "../../../identity/src/repositories/types.ts";
import { ForbiddenError } from "../../../identity/src/domain/errors.ts";
import { NotFoundError, ValidationError } from "../domain/errors.ts";
import { assertValidTransition } from "../domain/stateMachine.ts";
import type { HrLifecycleCase, HrProbationReview, RecordProbationDecisionInput } from "../domain/lifecycle.ts";

export function createProbationService(deps: {
  lifecycle: LifecycleCaseService;
  cases: LifecycleCaseRepository;
  reviews: ProbationReviewRepository;
  organisation: OrganisationRepository;
  rbac: RbacService;
  audit: AuditService;
}) {
  return {
    async createProbationCase(
      actor: ActorContext,
      input: { employeeId: string; legalEntityId: string; hrOwnerUserId: string; periodStart: string; expectedReviewDate: string; responsibleManagerUserId?: string | null },
    ): Promise<{ case: HrLifecycleCase; review: HrProbationReview }> {
      if (!input.periodStart) throw new ValidationError("periodStart is required.");
      if (!input.expectedReviewDate) throw new ValidationError("expectedReviewDate is required.");
      if (input.expectedReviewDate < input.periodStart) throw new ValidationError("expectedReviewDate must not be before periodStart.");

      let createdReview: HrProbationReview | undefined;
      const created = await deps.lifecycle.createCase(
        actor,
        { employeeId: input.employeeId, legalEntityId: input.legalEntityId, lifecycleType: "probation", hrOwnerUserId: input.hrOwnerUserId, currentStage: "initial_period" },
        { data: { periodStart: input.periodStart, expectedReviewDate: input.expectedReviewDate } },
        async (repos, createdCase) => {
          createdReview = await repos.reviews.create({
            caseId: createdCase.id,
            sequenceNumber: 1,
            periodStart: input.periodStart,
            expectedReviewDate: input.expectedReviewDate,
            responsibleManagerUserId: input.responsibleManagerUserId ?? null,
            responsibleHrOwnerUserId: input.hrOwnerUserId,
          });
          assertValidTransition("DRAFT", "IN_PROGRESS");
          await repos.cases.updateStatus(createdCase.id, { status: "IN_PROGRESS", updatedBy: actor.userId });
        },
      );
      return { case: created, review: createdReview! };
    },

    async listReviews(actor: ActorContext, caseId: string): Promise<{ reviews: HrProbationReview[]; canReadRestricted: boolean; canReadDecision: boolean }> {
      const hrCase = await deps.cases.findById(caseId);
      if (!hrCase) throw new NotFoundError("Lifecycle case");
      const { allowedBase, canReadRestricted, canReadDecision } = await deps.lifecycle.resolveAccess(actor, hrCase);
      if (!allowedBase) throw new NotFoundError("Lifecycle case");
      return { reviews: await deps.reviews.listByCase(caseId), canReadRestricted, canReadDecision };
    },

    /**
     * Records the decision for the CURRENT (highest-sequence) review of a
     * case, exactly once — see pgProbationReviewRepository.recordDecision's
     * `WHERE review_status = 'PENDING'` guard. A CONFIRMED or UNSUCCESSFUL
     * decision completes the case; an EXTENDED decision creates the NEXT
     * probation period (a new row, never rewriting the current one) and
     * returns the case to IN_PROGRESS. All of this — decision, optional
     * extension row, case status, and events — commits atomically.
     */
    async recordDecision(actor: ActorContext, caseId: string, input: RecordProbationDecisionInput): Promise<{ case: HrLifecycleCase; review: HrProbationReview; extension?: HrProbationReview }> {
      const hrCase = await deps.cases.findById(caseId);
      if (!hrCase) throw new NotFoundError("Lifecycle case");
      if (hrCase.lifecycleType !== "probation") throw new ValidationError("This case is not a probation case.");

      const legalEntity = await deps.organisation.findLegalEntityById(hrCase.legalEntityId);
      if (!legalEntity) throw new ValidationError("Case's legalEntityId does not refer to a known legal entity.");
      const ceiling = baseCeiling(legalEntity);
      const access = await checkAccess(deps.rbac, actor.userId, PERMISSIONS.MANAGE_PROBATION, PERMISSIONS.MANAGE_PROBATION_PRIVILEGED, { legalEntityId: hrCase.legalEntityId, recordClassification: ceiling });
      if (!access.allowed) throw new ForbiddenError(PERMISSIONS.MANAGE_PROBATION);

      const current = await deps.reviews.findCurrent(caseId);
      if (!current) throw new ValidationError("This case has no probation review to decide.");
      if (current.reviewStatus !== "PENDING") throw new ValidationError("This probation review already has a recorded decision.");

      if (input.decision === "EXTENDED") {
        if (!input.extension) throw new ValidationError("extension terms are required when decision is EXTENDED.");
        if (!input.extension.periodStart || !input.extension.expectedReviewDate) throw new ValidationError("extension.periodStart and extension.expectedReviewDate are required.");
        if (input.extension.expectedReviewDate < input.extension.periodStart) throw new ValidationError("extension.expectedReviewDate must not be before extension.periodStart.");
      }

      // EXTENDED keeps the case IN_PROGRESS (a same-status no-op — see
      // domain/stateMachine.ts); CONFIRMED/UNSUCCESSFUL complete it.
      // transitionCase() below re-validates this against the case's
      // actual current status via assertValidTransition.
      const nextStatus = input.decision === "EXTENDED" ? "IN_PROGRESS" : "COMPLETED";

      let extensionReview: HrProbationReview | undefined;
      const updated = await deps.lifecycle.transitionCase(
        actor,
        caseId,
        { base: PERMISSIONS.MANAGE_PROBATION, privileged: PERMISSIONS.MANAGE_PROBATION_PRIVILEGED },
        { status: nextStatus, outcome: input.decision, effectiveDate: input.decisionDate, currentStage: input.decision === "EXTENDED" ? "extended_period" : "decided" },
        { type: "decision_recorded", data: { decision: input.decision, reviewId: current.id }, notes: input.decisionNotes ?? null },
        async (repos) => {
          await repos.reviews.recordDecision(current.id, {
            decision: input.decision,
            recommendation: input.recommendation ?? null,
            decisionNotes: input.decisionNotes ?? null,
            decisionDate: input.decisionDate,
            decidedBy: actor.userId,
          });
          if (input.decision === "EXTENDED" && input.extension) {
            extensionReview = await repos.reviews.create({
              caseId,
              sequenceNumber: current.sequenceNumber + 1,
              periodStart: input.extension.periodStart,
              expectedReviewDate: input.extension.expectedReviewDate,
              responsibleManagerUserId: input.extension.responsibleManagerUserId ?? current.responsibleManagerUserId,
              responsibleHrOwnerUserId: input.extension.responsibleHrOwnerUserId ?? current.responsibleHrOwnerUserId,
            });
            await repos.events.append({ caseId, eventType: "probation_extended", eventData: { previousReviewId: current.id, newReviewId: extensionReview.id }, recordedBy: actor.userId });
          }
          if (input.decision === "CONFIRMED") {
            await repos.events.append({ caseId, eventType: "confirmation_completed", eventData: { reviewId: current.id }, recordedBy: actor.userId });
          }
        },
      );

      const review = (await deps.reviews.findById(current.id))!;
      return { case: updated, review, extension: extensionReview };
    },
  };
}

export type ProbationService = ReturnType<typeof createProbationService>;
