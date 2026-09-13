/**
 * /api/v1/workflow/definitions and /api/v1/workflow/versions — definition
 * lifecycle (DRAFT/PUBLISHED/RETIRED) and step editing. Every handler
 * allowlists exactly the client fields it accepts (PR brief item 34).
 */
import { sendSuccess, readJsonBody } from "../../../../identity/src/api/middleware/envelope.ts";
import { requireActor } from "../middleware/actor.ts";
import { ValidationError } from "../../domain/errors.ts";
import type { WorkflowDefinition, WorkflowDefinitionVersion, WorkflowStep, StepType, AssignmentMode, ApprovalDecisionType, EscalationTargetMode } from "../../domain/workflow.ts";
import { respondError, toActorContext, type RouteContext } from "./shared.ts";

function serializeDefinition(d: WorkflowDefinition) {
  return { id: d.id, key: d.key, name: d.name, description: d.description, createdBy: d.createdBy, createdAt: d.createdAt, updatedAt: d.updatedAt };
}

function serializeVersion(v: WorkflowDefinitionVersion) {
  return { id: v.id, definitionId: v.definitionId, versionNumber: v.versionNumber, status: v.status, publishedAt: v.publishedAt, retiredAt: v.retiredAt, createdAt: v.createdAt };
}

function serializeStep(s: WorkflowStep) {
  return {
    id: s.id,
    versionId: s.versionId,
    sequenceNumber: s.sequenceNumber,
    stepType: s.stepType,
    name: s.name,
    assignmentMode: s.assignmentMode,
    assignedPermissionKey: s.assignedPermissionKey,
    allowSelfApproval: s.allowSelfApproval,
    permittedDecisions: s.permittedDecisions,
    systemActionHandlerKey: s.systemActionHandlerKey,
    dueAfterMinutes: s.dueAfterMinutes,
    escalateAfterMinutes: s.escalateAfterMinutes,
    escalationTargetMode: s.escalationTargetMode,
  };
}

function parseStepInput(body: Record<string, unknown>) {
  return {
    sequenceNumber: Number(body.sequenceNumber),
    stepType: String(body.stepType ?? "") as StepType,
    name: String(body.name ?? ""),
    assignmentMode: typeof body.assignmentMode === "string" ? (body.assignmentMode as AssignmentMode) : null,
    assignedPermissionKey: typeof body.assignedPermissionKey === "string" ? body.assignedPermissionKey : null,
    allowSelfApproval: body.allowSelfApproval === true,
    permittedDecisions: Array.isArray(body.permittedDecisions) ? (body.permittedDecisions as ApprovalDecisionType[]) : null,
    systemActionHandlerKey: typeof body.systemActionHandlerKey === "string" ? body.systemActionHandlerKey : null,
    dueAfterMinutes: typeof body.dueAfterMinutes === "number" ? body.dueAfterMinutes : null,
    escalateAfterMinutes: typeof body.escalateAfterMinutes === "number" ? body.escalateAfterMinutes : null,
    escalationTargetMode: (typeof body.escalationTargetMode === "string" ? body.escalationTargetMode : "NONE") as EscalationTargetMode,
  };
}

export async function handleCreateDefinition(ctx: RouteContext): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const body = await readJsonBody<Record<string, unknown>>(ctx.req);
    const result = await ctx.container.definitions.createDefinition(toActorContext(actor, ctx.req), {
      key: String(body.key ?? ""),
      name: String(body.name ?? ""),
      description: typeof body.description === "string" ? body.description : null,
    });
    sendSuccess(ctx.res, 201, { definition: serializeDefinition(result.definition), version: serializeVersion(result.version) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleListDefinitions(ctx: RouteContext): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const definitions = await ctx.container.definitions.listDefinitions(toActorContext(actor, ctx.req));
    sendSuccess(ctx.res, 200, { definitions: definitions.map(serializeDefinition) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleGetDefinition(ctx: RouteContext, id: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const definition = await ctx.container.definitions.getDefinition(toActorContext(actor, ctx.req), id);
    const versions = await ctx.container.definitions.listVersions(toActorContext(actor, ctx.req), id);
    sendSuccess(ctx.res, 200, { definition: serializeDefinition(definition), versions: versions.map(serializeVersion) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleCreateDraftVersion(ctx: RouteContext, definitionId: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const version = await ctx.container.definitions.createDraftVersion(toActorContext(actor, ctx.req), definitionId);
    sendSuccess(ctx.res, 201, { version: serializeVersion(version) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleGetVersion(ctx: RouteContext, versionId: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const { version, steps } = await ctx.container.definitions.getVersion(toActorContext(actor, ctx.req), versionId);
    sendSuccess(ctx.res, 200, { version: serializeVersion(version), steps: steps.map(serializeStep) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleAddStep(ctx: RouteContext, versionId: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const body = await readJsonBody<Record<string, unknown>>(ctx.req);
    if (!Number.isFinite(Number(body.sequenceNumber))) throw new ValidationError("sequenceNumber is required.");
    const step = await ctx.container.definitions.addStep(toActorContext(actor, ctx.req), versionId, parseStepInput(body));
    sendSuccess(ctx.res, 201, { step: serializeStep(step) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleUpdateStep(ctx: RouteContext, versionId: string, stepId: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const body = await readJsonBody<Record<string, unknown>>(ctx.req);
    const step = await ctx.container.definitions.updateStep(toActorContext(actor, ctx.req), versionId, stepId, parseStepInput(body));
    sendSuccess(ctx.res, 200, { step: serializeStep(step) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleDeleteStep(ctx: RouteContext, versionId: string, stepId: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    await ctx.container.definitions.deleteStep(toActorContext(actor, ctx.req), versionId, stepId);
    sendSuccess(ctx.res, 200, { deleted: true }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handlePublishVersion(ctx: RouteContext, versionId: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const version = await ctx.container.definitions.publish(toActorContext(actor, ctx.req), versionId);
    sendSuccess(ctx.res, 200, { version: serializeVersion(version) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleRetireVersion(ctx: RouteContext, versionId: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const version = await ctx.container.definitions.retire(toActorContext(actor, ctx.req), versionId);
    sendSuccess(ctx.res, 200, { version: serializeVersion(version) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}
