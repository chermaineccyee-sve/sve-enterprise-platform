/**
 * /api/v1/workflow/instances — start/read/list/cancel/history. Every
 * handler allowlists exactly the client fields it accepts (PR brief item
 * 34); `id`/`status`/`currentStepId` are always server-controlled.
 */
import { sendSuccess, readJsonBody } from "../../../../identity/src/api/middleware/envelope.ts";
import { requireActor } from "../middleware/actor.ts";
import { ValidationError } from "../../domain/errors.ts";
import type { WorkflowInstance, WorkflowEvent, DataClassification, InstanceStatus } from "../../domain/workflow.ts";
import { respondError, toActorContext, type RouteContext } from "./shared.ts";

function serializeInstance(i: WorkflowInstance) {
  return {
    id: i.id,
    definitionId: i.definitionId,
    versionId: i.versionId,
    subjectType: i.subjectType,
    subjectId: i.subjectId,
    legalEntityId: i.legalEntityId,
    dataClassification: i.dataClassification,
    status: i.status,
    outcome: i.outcome,
    failureCategory: i.failureCategory,
    currentStepId: i.currentStepId,
    requesterUserId: i.requesterUserId,
    startedAt: i.startedAt,
    completedAt: i.completedAt,
    cancelledAt: i.cancelledAt,
  };
}

function serializeEvent(e: WorkflowEvent) {
  return { id: e.id, eventType: e.eventType, eventData: e.eventData, notes: e.notes, occurredAt: e.occurredAt, recordedBy: e.recordedBy };
}

export async function handleStartInstance(ctx: RouteContext): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const body = await readJsonBody<Record<string, unknown>>(ctx.req);
    if (!body.definitionKey || typeof body.definitionKey !== "string") throw new ValidationError("definitionKey is required.");
    const instance = await ctx.container.instances.startWorkflow(toActorContext(actor, ctx.req), {
      definitionKey: body.definitionKey,
      subjectType: String(body.subjectType ?? ""),
      subjectId: String(body.subjectId ?? ""),
      legalEntityId: String(body.legalEntityId ?? ""),
      dataClassification: typeof body.dataClassification === "string" ? (body.dataClassification as DataClassification) : undefined,
      subjectEmployeeId: typeof body.subjectEmployeeId === "string" ? body.subjectEmployeeId : null,
      subjectActorUserId: typeof body.subjectActorUserId === "string" ? body.subjectActorUserId : null,
      idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : null,
      context: typeof body.context === "object" && body.context !== null ? (body.context as Record<string, unknown>) : null,
      stepAssignments: typeof body.stepAssignments === "object" && body.stepAssignments !== null ? (body.stepAssignments as Record<number, { userId: string }>) : undefined,
    });
    sendSuccess(ctx.res, 201, { instance: serializeInstance(instance) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleGetInstance(ctx: RouteContext, id: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const instance = await ctx.container.instances.getInstance(toActorContext(actor, ctx.req), id);
    sendSuccess(ctx.res, 200, { instance: serializeInstance(instance) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleListInstances(ctx: RouteContext): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const url = new URL(ctx.req.url ?? "/", "http://localhost");
    const instances = await ctx.container.instances.listInstances(toActorContext(actor, ctx.req), {
      status: (url.searchParams.get("status") as InstanceStatus | null) ?? undefined,
      subjectType: url.searchParams.get("subjectType") ?? undefined,
      subjectId: url.searchParams.get("subjectId") ?? undefined,
      legalEntityId: url.searchParams.get("legalEntityId") ?? undefined,
    });
    sendSuccess(ctx.res, 200, { instances: instances.map(serializeInstance) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleGetInstanceHistory(ctx: RouteContext, id: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const events = await ctx.container.instances.getInstanceHistory(toActorContext(actor, ctx.req), id);
    sendSuccess(ctx.res, 200, { events: events.map(serializeEvent) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleCancelInstance(ctx: RouteContext, id: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const instance = await ctx.container.instances.cancelInstance(toActorContext(actor, ctx.req), id);
    sendSuccess(ctx.res, 200, { instance: serializeInstance(instance) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}
