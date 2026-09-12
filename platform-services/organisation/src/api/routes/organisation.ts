/**
 * /api/v1/organisation/* — business units, departments, positions, and a
 * legal-entities reference passthrough. See docs/architecture/
 * organisation-employee-master.md "API" for the full route table.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { OrganisationContainer } from "../../composition/container.ts";
import { sendSuccess, sendError, readJsonBody } from "../../../../identity/src/api/middleware/envelope.ts";
import { requireActor, clientIp } from "../middleware/actor.ts";
import { SessionInvalidError, AccountDisabledError, ForbiddenError } from "../../../../identity/src/domain/errors.ts";
import { ValidationError } from "../../domain/errors.ts";

interface RouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  container: OrganisationContainer;
  correlationId: string;
}

function respondError(res: ServerResponse, correlationId: string, error: unknown): void {
  if (error instanceof SessionInvalidError) return sendError(res, 401, "SESSION_INVALID", "Not authenticated.", correlationId);
  if (error instanceof AccountDisabledError) return sendError(res, 403, "ACCOUNT_DISABLED", "Account is disabled.", correlationId);
  if (error instanceof ForbiddenError) return sendError(res, 403, "FORBIDDEN", "Not authorised for this action.", correlationId);
  if (error instanceof ValidationError) return sendError(res, 400, "VALIDATION_ERROR", error.message, correlationId);
  throw error;
}

function toActorContext(actor: { userId: string; email: string }, req: IncomingMessage) {
  return { userId: actor.userId, email: actor.email, ip: clientIp(req), userAgent: (req.headers["user-agent"] as string | undefined) ?? null };
}

export async function handleListLegalEntities(ctx: RouteContext): Promise<void> {
  try {
    await requireActor(ctx.req, ctx.container);
    const entities = await ctx.container.organisation.listLegalEntities();
    sendSuccess(ctx.res, 200, { legalEntities: entities.map((e) => ({ id: e.id, key: e.key, name: e.name, jurisdiction: e.jurisdiction, isGroupHeadquarters: e.isGroupHeadquarters })) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleListBusinessUnits(ctx: RouteContext): Promise<void> {
  try {
    await requireActor(ctx.req, ctx.container);
    const url = new URL(ctx.req.url ?? "/", "http://localhost");
    const units = await ctx.container.orgStructure.listBusinessUnits({ legalEntityId: url.searchParams.get("legalEntityId") ?? undefined });
    sendSuccess(ctx.res, 200, { businessUnits: units }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleCreateBusinessUnit(ctx: RouteContext): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const body = await readJsonBody<Record<string, unknown>>(ctx.req);
    const unit = await ctx.container.orgStructure.createBusinessUnit(toActorContext(actor, ctx.req), {
      legalEntityId: String(body.legalEntityId ?? ""),
      name: String(body.name ?? ""),
      code: String(body.code ?? ""),
    });
    sendSuccess(ctx.res, 201, { businessUnit: unit }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleListDepartments(ctx: RouteContext): Promise<void> {
  try {
    await requireActor(ctx.req, ctx.container);
    const url = new URL(ctx.req.url ?? "/", "http://localhost");
    const departments = await ctx.container.orgStructure.listDepartments({
      legalEntityId: url.searchParams.get("legalEntityId") ?? undefined,
      businessUnitId: url.searchParams.get("businessUnitId") ?? undefined,
    });
    sendSuccess(ctx.res, 200, { departments }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleCreateDepartment(ctx: RouteContext): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const body = await readJsonBody<Record<string, unknown>>(ctx.req);
    const department = await ctx.container.orgStructure.createDepartment(toActorContext(actor, ctx.req), {
      legalEntityId: String(body.legalEntityId ?? ""),
      businessUnitId: typeof body.businessUnitId === "string" ? body.businessUnitId : null,
      name: String(body.name ?? ""),
      code: String(body.code ?? ""),
    });
    sendSuccess(ctx.res, 201, { department }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleListPositions(ctx: RouteContext): Promise<void> {
  try {
    await requireActor(ctx.req, ctx.container);
    const url = new URL(ctx.req.url ?? "/", "http://localhost");
    const positions = await ctx.container.orgStructure.listPositions({ departmentId: url.searchParams.get("departmentId") ?? undefined });
    sendSuccess(ctx.res, 200, { positions }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleCreatePosition(ctx: RouteContext): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const body = await readJsonBody<Record<string, unknown>>(ctx.req);
    const position = await ctx.container.orgStructure.createPosition(toActorContext(actor, ctx.req), {
      departmentId: String(body.departmentId ?? ""),
      title: String(body.title ?? ""),
      reportsToPositionId: typeof body.reportsToPositionId === "string" ? body.reportsToPositionId : null,
      costCentreCode: typeof body.costCentreCode === "string" ? body.costCentreCode : null,
    });
    sendSuccess(ctx.res, 201, { position }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}
