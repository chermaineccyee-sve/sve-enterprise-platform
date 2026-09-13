/**
 * /api/v1/hrms/lifecycle/* — HR Lifecycle API. Directory-like base fields
 * are included whenever the base read check passes; restricted fields
 * only when the view's canReadRestricted is true; decision-tier content
 * (recommendations/decision notes/termination rationale) only when
 * canReadDecision is true. See docs/architecture/hrms-employee-lifecycle.md
 * "Sensitive HR data".
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { HrmsContainer } from "../../composition/container.ts";
import { sendSuccess, sendError, readJsonBody } from "../../../../identity/src/api/middleware/envelope.ts";
import { requireActor, clientIp } from "../middleware/actor.ts";
import { SessionInvalidError, AccountDisabledError, ForbiddenError } from "../../../../identity/src/domain/errors.ts";
import { NotFoundError, ValidationError, InvalidTransitionError } from "../../domain/errors.ts";
import type { LifecycleCaseView } from "../../services/lifecycleCaseService.ts";
import type { HrLifecycleCase, HrLifecycleEvent, HrLifecycleMilestone, HrProbationReview, LifecycleType, LifecycleStatus, MilestoneStatus, ProbationDecision } from "../../domain/lifecycle.ts";

interface RouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  container: HrmsContainer;
  correlationId: string;
}

function respondError(res: ServerResponse, correlationId: string, error: unknown): void {
  if (error instanceof SessionInvalidError) return sendError(res, 401, "SESSION_INVALID", "Not authenticated.", correlationId);
  if (error instanceof AccountDisabledError) return sendError(res, 403, "ACCOUNT_DISABLED", "Account is disabled.", correlationId);
  if (error instanceof NotFoundError) return sendError(res, 404, "NOT_FOUND", "Lifecycle case not found.", correlationId);
  if (error instanceof ForbiddenError) return sendError(res, 403, "FORBIDDEN", "Not authorised for this action.", correlationId);
  if (error instanceof InvalidTransitionError) return sendError(res, 409, "INVALID_TRANSITION", error.message, correlationId);
  if (error instanceof ValidationError) return sendError(res, 400, "VALIDATION_ERROR", error.message, correlationId);
  throw error;
}

function toActorContext(actor: { userId: string; email: string }, req: IncomingMessage) {
  return { userId: actor.userId, email: actor.email, ip: clientIp(req), userAgent: (req.headers["user-agent"] as string | undefined) ?? null };
}

function serializeCaseBase(c: HrLifecycleCase) {
  return { id: c.id, caseNumber: c.caseNumber, employeeId: c.employeeId, legalEntityId: c.legalEntityId, lifecycleType: c.lifecycleType, status: c.status, initiatedAt: c.initiatedAt, hrOwnerUserId: c.hrOwnerUserId, createdAt: c.createdAt, updatedAt: c.updatedAt };
}

function serializeCaseRestricted(c: HrLifecycleCase) {
  return {
    caseSubtype: c.caseSubtype,
    currentStage: c.currentStage,
    effectiveDate: c.effectiveDate,
    outcome: c.outcome,
    reasonCategory: c.reasonCategory,
    noticeDate: c.noticeDate,
    intendedLastWorkingDate: c.intendedLastWorkingDate,
    resultingAssignmentId: c.resultingAssignmentId,
    completedAt: c.completedAt,
    cancelledAt: c.cancelledAt,
  };
}

function serializeCaseView(view: LifecycleCaseView) {
  return { ...serializeCaseBase(view.case), restricted: view.canReadRestricted ? serializeCaseRestricted(view.case) : null };
}

function serializeEvent(e: HrLifecycleEvent, canReadRestricted: boolean, canReadDecision: boolean) {
  return { id: e.id, eventType: e.eventType, occurredAt: e.occurredAt, recordedBy: e.recordedBy, eventData: canReadRestricted ? e.eventData : null, notes: canReadDecision ? e.notes : null };
}

function serializeMilestone(m: HrLifecycleMilestone, canReadRestricted: boolean) {
  return { id: m.id, milestoneType: m.milestoneType, status: m.status, dueDate: m.dueDate, completedAt: m.completedAt, completedBy: m.completedBy, reference: m.reference, notes: canReadRestricted ? m.notes : null };
}

function serializeReview(r: HrProbationReview, canReadRestricted: boolean, canReadDecision: boolean) {
  return {
    id: r.id,
    sequenceNumber: r.sequenceNumber,
    periodStart: r.periodStart,
    expectedReviewDate: r.expectedReviewDate,
    reviewStatus: r.reviewStatus,
    decision: canReadRestricted ? r.decision : null,
    decisionDate: canReadRestricted ? r.decisionDate : null,
    responsibleManagerUserId: canReadRestricted ? r.responsibleManagerUserId : null,
    responsibleHrOwnerUserId: canReadRestricted ? r.responsibleHrOwnerUserId : null,
    recommendation: canReadDecision ? r.recommendation : null,
    decisionNotes: canReadDecision ? r.decisionNotes : null,
  };
}

export async function handleGetCase(ctx: RouteContext, id: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const view = await ctx.container.lifecycle.getCase(toActorContext(actor, ctx.req), id);
    sendSuccess(ctx.res, 200, { case: serializeCaseView(view) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleListCases(ctx: RouteContext): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const url = new URL(ctx.req.url ?? "/", "http://localhost");
    const views = await ctx.container.lifecycle.listCases(toActorContext(actor, ctx.req), {
      employeeId: url.searchParams.get("employeeId") ?? undefined,
      legalEntityId: url.searchParams.get("legalEntityId") ?? undefined,
      lifecycleType: (url.searchParams.get("lifecycleType") as LifecycleType | null) ?? undefined,
      status: (url.searchParams.get("status") as LifecycleStatus | null) ?? undefined,
    });
    sendSuccess(ctx.res, 200, { cases: views.map(serializeCaseView) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleCreateCase(ctx: RouteContext): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const body = await readJsonBody<Record<string, unknown>>(ctx.req);
    const actorCtx = toActorContext(actor, ctx.req);
    const lifecycleType = String(body.lifecycleType ?? "");

    let result: HrLifecycleCase;
    if (lifecycleType === "onboarding") {
      result = await ctx.container.onboarding.createOnboardingCase(actorCtx, {
        employeeId: String(body.employeeId ?? ""),
        legalEntityId: String(body.legalEntityId ?? ""),
        hrOwnerUserId: String(body.hrOwnerUserId ?? ""),
        currentStage: typeof body.currentStage === "string" ? body.currentStage : null,
        initialMilestones: Array.isArray(body.initialMilestones) ? body.initialMilestones.map(String) : [],
      });
    } else if (lifecycleType === "probation") {
      const created = await ctx.container.probation.createProbationCase(actorCtx, {
        employeeId: String(body.employeeId ?? ""),
        legalEntityId: String(body.legalEntityId ?? ""),
        hrOwnerUserId: String(body.hrOwnerUserId ?? ""),
        periodStart: String(body.periodStart ?? ""),
        expectedReviewDate: String(body.expectedReviewDate ?? ""),
        responsibleManagerUserId: typeof body.responsibleManagerUserId === "string" ? body.responsibleManagerUserId : null,
      });
      result = created.case;
    } else if (lifecycleType === "employment_change") {
      result = await ctx.container.employmentChange.createChangeCase(actorCtx, {
        employeeId: String(body.employeeId ?? ""),
        legalEntityId: String(body.legalEntityId ?? ""),
        hrOwnerUserId: String(body.hrOwnerUserId ?? ""),
        changeType: String(body.changeType ?? ""),
        reasonCategory: typeof body.reasonCategory === "string" ? body.reasonCategory : null,
        proposedChangeSummary: typeof body.proposedChangeSummary === "object" && body.proposedChangeSummary !== null ? (body.proposedChangeSummary as Record<string, unknown>) : {},
      });
    } else if (lifecycleType === "offboarding") {
      result = await ctx.container.offboarding.createOffboardingCase(actorCtx, {
        employeeId: String(body.employeeId ?? ""),
        legalEntityId: String(body.legalEntityId ?? ""),
        hrOwnerUserId: String(body.hrOwnerUserId ?? ""),
        separationType: String(body.separationType ?? ""),
        reasonCategory: typeof body.reasonCategory === "string" ? body.reasonCategory : null,
        noticeDate: typeof body.noticeDate === "string" ? body.noticeDate : null,
        intendedLastWorkingDate: typeof body.intendedLastWorkingDate === "string" ? body.intendedLastWorkingDate : null,
        clearanceMilestones: Array.isArray(body.clearanceMilestones) ? body.clearanceMilestones.map(String) : [],
      });
    } else {
      return sendError(ctx.res, 400, "VALIDATION_ERROR", "lifecycleType must be one of onboarding, probation, employment_change, offboarding.", ctx.correlationId);
    }
    sendSuccess(ctx.res, 201, { case: serializeCaseBase(result) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleCompleteCase(ctx: RouteContext, id: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const body = await readJsonBody<Record<string, unknown>>(ctx.req);
    const result = await ctx.container.lifecycle.completeCase(toActorContext(actor, ctx.req), id, {
      outcome: typeof body.outcome === "string" ? body.outcome : null,
      effectiveDate: typeof body.effectiveDate === "string" ? body.effectiveDate : null,
    });
    sendSuccess(ctx.res, 200, { case: serializeCaseBase(result) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleCancelCase(ctx: RouteContext, id: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const body = await readJsonBody<Record<string, unknown>>(ctx.req);
    const result = await ctx.container.lifecycle.cancelCase(toActorContext(actor, ctx.req), id, { reason: typeof body.reason === "string" ? body.reason : null });
    sendSuccess(ctx.res, 200, { case: serializeCaseBase(result) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleListEvents(ctx: RouteContext, id: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const { events, canReadRestricted, canReadDecision } = await ctx.container.lifecycle.listEvents(toActorContext(actor, ctx.req), id);
    sendSuccess(ctx.res, 200, { events: events.map((e) => serializeEvent(e, canReadRestricted, canReadDecision)) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleListMilestones(ctx: RouteContext, id: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const { milestones, canReadRestricted } = await ctx.container.lifecycle.listMilestones(toActorContext(actor, ctx.req), id);
    sendSuccess(ctx.res, 200, { milestones: milestones.map((m) => serializeMilestone(m, canReadRestricted)) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleAddMilestone(ctx: RouteContext, id: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const body = await readJsonBody<Record<string, unknown>>(ctx.req);
    const actorCtx = toActorContext(actor, ctx.req);
    const input = { milestoneType: String(body.milestoneType ?? ""), dueDate: typeof body.dueDate === "string" ? body.dueDate : null, reference: typeof body.reference === "string" ? body.reference : null, notes: typeof body.notes === "string" ? body.notes : null };
    const hrCase = await ctx.container.lifecycle.getCase(actorCtx, id);
    const milestone = hrCase.case.lifecycleType === "offboarding" ? await ctx.container.offboarding.addClearanceMilestone(actorCtx, id, input) : await ctx.container.onboarding.addMilestone(actorCtx, id, input);
    sendSuccess(ctx.res, 201, { milestone: serializeMilestone(milestone, true) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleUpdateMilestone(ctx: RouteContext, id: string, milestoneId: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const body = await readJsonBody<Record<string, unknown>>(ctx.req);
    const actorCtx = toActorContext(actor, ctx.req);
    const status = String(body.status ?? "") as MilestoneStatus;
    const notes = typeof body.notes === "string" ? body.notes : undefined;
    const hrCase = await ctx.container.lifecycle.getCase(actorCtx, id);
    const milestone =
      hrCase.case.lifecycleType === "offboarding"
        ? await ctx.container.offboarding.updateClearanceMilestone(actorCtx, id, milestoneId, { status, notes })
        : await ctx.container.onboarding.completeMilestone(actorCtx, id, milestoneId, notes);
    sendSuccess(ctx.res, 200, { milestone: serializeMilestone(milestone, true) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleListProbationReviews(ctx: RouteContext, id: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const { reviews, canReadRestricted, canReadDecision } = await ctx.container.probation.listReviews(toActorContext(actor, ctx.req), id);
    sendSuccess(ctx.res, 200, { reviews: reviews.map((r) => serializeReview(r, canReadRestricted, canReadDecision)) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleRecordProbationDecision(ctx: RouteContext, id: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const body = await readJsonBody<Record<string, unknown>>(ctx.req);
    const extensionBody = typeof body.extension === "object" && body.extension !== null ? (body.extension as Record<string, unknown>) : null;
    const result = await ctx.container.probation.recordDecision(toActorContext(actor, ctx.req), id, {
      decision: String(body.decision ?? "") as ProbationDecision,
      recommendation: typeof body.recommendation === "string" ? body.recommendation : null,
      decisionNotes: typeof body.decisionNotes === "string" ? body.decisionNotes : null,
      decisionDate: String(body.decisionDate ?? ""),
      extension: extensionBody
        ? {
            periodStart: String(extensionBody.periodStart ?? ""),
            expectedReviewDate: String(extensionBody.expectedReviewDate ?? ""),
            responsibleManagerUserId: typeof extensionBody.responsibleManagerUserId === "string" ? extensionBody.responsibleManagerUserId : null,
            responsibleHrOwnerUserId: typeof extensionBody.responsibleHrOwnerUserId === "string" ? extensionBody.responsibleHrOwnerUserId : null,
          }
        : null,
    });
    sendSuccess(ctx.res, 200, { case: serializeCaseBase(result.case), review: serializeReview(result.review, true, true), extension: result.extension ? serializeReview(result.extension, true, true) : null }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleCompleteEmploymentChange(ctx: RouteContext, id: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const body = await readJsonBody<Record<string, unknown>>(ctx.req);
    const result = await ctx.container.employmentChange.completeChange(toActorContext(actor, ctx.req), id, {
      legalEntityId: String(body.legalEntityId ?? ""),
      businessUnitId: typeof body.businessUnitId === "string" ? body.businessUnitId : null,
      departmentId: typeof body.departmentId === "string" ? body.departmentId : null,
      positionId: typeof body.positionId === "string" ? body.positionId : null,
      employmentType: String(body.employmentType ?? ""),
      status: String(body.status ?? "ACTIVE") as never,
      isPrimary: body.isPrimary === false ? false : true,
      startDate: String(body.startDate ?? ""),
      effectiveFrom: typeof body.effectiveFrom === "string" ? body.effectiveFrom : String(body.startDate ?? ""),
      workLocation: typeof body.workLocation === "string" ? body.workLocation : null,
      workArrangement: typeof body.workArrangement === "string" ? body.workArrangement : null,
      reportsToAssignmentId: typeof body.reportsToAssignmentId === "string" ? body.reportsToAssignmentId : null,
      changeReason: typeof body.changeReason === "string" ? body.changeReason : null,
    });
    sendSuccess(ctx.res, 200, { case: serializeCaseBase(result.case), assignment: { id: result.assignment.id, legalEntityId: result.assignment.legalEntityId, effectiveFrom: result.assignment.effectiveFrom } }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleSubmitForApproval(ctx: RouteContext, id: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const body = await readJsonBody<Record<string, unknown>>(ctx.req);
    const completionInput = typeof body.completionInput === "object" && body.completionInput !== null ? (body.completionInput as Record<string, unknown>) : null;
    const result = await ctx.container.approval.submitForApproval(toActorContext(actor, ctx.req), id, completionInput);
    sendSuccess(ctx.res, 200, { case: serializeCaseBase(result.case), workflowInstanceId: result.workflowInstanceId }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleGetApprovalStatus(ctx: RouteContext, id: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const result = await ctx.container.approval.getApprovalStatus(toActorContext(actor, ctx.req), id);
    sendSuccess(ctx.res, 200, result, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleCompleteOffboarding(ctx: RouteContext, id: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const body = await readJsonBody<Record<string, unknown>>(ctx.req);
    const status = body.status === "RESIGNED" ? "RESIGNED" : "TERMINATED";
    const result = await ctx.container.offboarding.completeOffboarding(toActorContext(actor, ctx.req), id, {
      endDate: String(body.endDate ?? ""),
      status,
      changeReason: typeof body.changeReason === "string" ? body.changeReason : undefined,
    });
    sendSuccess(ctx.res, 200, { case: serializeCaseBase(result.case), assignment: { id: result.assignment.id, effectiveTo: result.assignment.effectiveTo } }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}
