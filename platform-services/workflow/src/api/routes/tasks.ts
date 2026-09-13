/**
 * /api/v1/workflow/tasks and /api/v1/workflow/operations — task/approval
 * actions and the escalation sweep entry point.
 */
import { sendSuccess, readJsonBody } from "../../../../identity/src/api/middleware/envelope.ts";
import { requireActor } from "../middleware/actor.ts";
import { ValidationError } from "../../domain/errors.ts";
import type { WorkflowTask, TaskStatus, ApprovalDecisionType } from "../../domain/workflow.ts";
import { respondError, toActorContext, type RouteContext } from "./shared.ts";

function serializeTask(t: WorkflowTask) {
  return {
    id: t.id,
    instanceId: t.instanceId,
    stepId: t.stepId,
    taskType: t.taskType,
    assignmentMode: t.assignmentMode,
    assignedUserId: t.assignedUserId,
    status: t.status,
    dueAt: t.dueAt,
    escalateAfter: t.escalateAfter,
    escalatedAt: t.escalatedAt,
    createdAt: t.createdAt,
    completedAt: t.completedAt,
  };
}

export async function handleListAssignedTasks(ctx: RouteContext): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const url = new URL(ctx.req.url ?? "/", "http://localhost");
    const tasks = await ctx.container.tasks.listAssignedTasks(toActorContext(actor, ctx.req), {
      instanceId: url.searchParams.get("instanceId") ?? undefined,
      status: (url.searchParams.get("status") as TaskStatus | null) ?? undefined,
    });
    sendSuccess(ctx.res, 200, { tasks: tasks.map(serializeTask) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleGetTask(ctx: RouteContext, id: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const task = await ctx.container.tasks.getTask(toActorContext(actor, ctx.req), id);
    sendSuccess(ctx.res, 200, { task: serializeTask(task) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleDecideTask(ctx: RouteContext, id: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const body = await readJsonBody<Record<string, unknown>>(ctx.req);
    if (!body.decision || typeof body.decision !== "string") throw new ValidationError("decision is required.");
    const result = await ctx.container.tasks.decide(toActorContext(actor, ctx.req), id, {
      decision: body.decision as ApprovalDecisionType,
      comment: typeof body.comment === "string" ? body.comment : null,
    });
    sendSuccess(ctx.res, 200, { task: serializeTask(result.task), decision: { id: result.decision.id, decision: result.decision.decision, resultingTransition: result.decision.resultingTransition, decidedAt: result.decision.decidedAt } }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleCompleteTask(ctx: RouteContext, id: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const task = await ctx.container.tasks.completeTask(toActorContext(actor, ctx.req), id);
    sendSuccess(ctx.res, 200, { task: serializeTask(task) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleReassignTask(ctx: RouteContext, id: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const body = await readJsonBody<Record<string, unknown>>(ctx.req);
    if (!body.userId || typeof body.userId !== "string") throw new ValidationError("userId is required.");
    const task = await ctx.container.tasks.reassignTask(toActorContext(actor, ctx.req), id, { userId: body.userId });
    sendSuccess(ctx.res, 200, { task: serializeTask(task) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleProcessEscalations(ctx: RouteContext): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const result = await ctx.container.escalations.processDueEscalations(toActorContext(actor, ctx.req));
    sendSuccess(ctx.res, 200, result, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}
