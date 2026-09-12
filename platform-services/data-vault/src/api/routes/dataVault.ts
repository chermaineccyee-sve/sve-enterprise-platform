/**
 * /api/v1/data-vault/* — server-side Data Vault records API (PR #5). See
 * docs/architecture/data-vault-foundation.md "Data Vault API" for the full
 * route table and docs/architecture/api-conventions.md for the envelope
 * these responses use.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { DataVaultContainer } from "../../composition/container.ts";
import { sendSuccess, sendError, readJsonBody } from "../../../../identity/src/api/middleware/envelope.ts";
import { requireDataVaultActor } from "../middleware/dataVaultActor.ts";
import { SessionInvalidError, IdentityNotProvisionedError, AccountDisabledError, ForbiddenError } from "../../../../identity/src/domain/errors.ts";
import { NotFoundError, ValidationError, CsrfOriginRejectedError } from "../../domain/errors.ts";
import type { DataClassification } from "../../../../../packages/types/src/entity-context.ts";
import type { DataVaultStatus, DataVaultRecord, CreateDataVaultRecordInput, UpdateDataVaultRecordInput } from "../../domain/dataVault.ts";

interface RouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  container: DataVaultContainer;
  correlationId: string;
}

function clientIp(req: IncomingMessage): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) return forwarded.split(",")[0]!.trim();
  return req.socket.remoteAddress ?? null;
}

function respondError(res: ServerResponse, correlationId: string, error: unknown): void {
  if (error instanceof SessionInvalidError) return sendError(res, 401, "SESSION_INVALID", "Not authenticated.", correlationId);
  if (error instanceof IdentityNotProvisionedError) {
    return sendError(res, 403, "IDENTITY_NOT_PROVISIONED", error.message, correlationId);
  }
  if (error instanceof CsrfOriginRejectedError) return sendError(res, 403, "CSRF_ORIGIN_REJECTED", error.message, correlationId);
  if (error instanceof AccountDisabledError) return sendError(res, 403, "ACCOUNT_DISABLED", "Account is disabled.", correlationId);
  if (error instanceof NotFoundError) return sendError(res, 404, "NOT_FOUND", "Data Vault record not found.", correlationId);
  if (error instanceof ForbiddenError) return sendError(res, 403, "FORBIDDEN", "Not authorised for this action.", correlationId);
  if (error instanceof ValidationError) return sendError(res, 400, "VALIDATION_ERROR", error.message, correlationId);
  throw error;
}

function toActorContext(actor: { userId: string; email: string }, req: IncomingMessage) {
  return { userId: actor.userId, email: actor.email, ip: clientIp(req), userAgent: (req.headers["user-agent"] as string | undefined) ?? null };
}

const VALID_CLASSIFICATIONS = new Set(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED", "PRIVILEGED"]);
const VALID_STATUSES = new Set(["Requires Review", "Report Ready", "Monitoring", "Archived"]);

function serializeRecord(record: DataVaultRecord) {
  return {
    id: record.id,
    recordCode: record.recordCode,
    legalEntityId: record.legalEntityId,
    jurisdiction: record.jurisdiction,
    category: record.category,
    topic: record.topic,
    source: record.source,
    tier: record.tier,
    confidence: record.confidence,
    checkedDate: record.checkedDate,
    classification: record.classification,
    status: record.status,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    archivedAt: record.archivedAt,
  };
}

export async function handleListRecords(ctx: RouteContext): Promise<void> {
  try {
    const actor = await requireDataVaultActor(ctx.req, ctx.container);
    const url = new URL(ctx.req.url ?? "/", "http://localhost");
    const classification = url.searchParams.get("classification");
    const status = url.searchParams.get("status");
    if (classification && !VALID_CLASSIFICATIONS.has(classification)) {
      return sendError(ctx.res, 400, "VALIDATION_ERROR", "classification filter is invalid.", ctx.correlationId);
    }
    if (status && !VALID_STATUSES.has(status)) {
      return sendError(ctx.res, 400, "VALIDATION_ERROR", "status filter is invalid.", ctx.correlationId);
    }
    const records = await ctx.container.dataVault.listRecords(toActorContext(actor, ctx.req), {
      legalEntityId: url.searchParams.get("legalEntityId") ?? undefined,
      classification: (classification as DataClassification | null) ?? undefined,
      status: (status as DataVaultStatus | null) ?? undefined,
      tier: url.searchParams.get("tier") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      checkedFrom: url.searchParams.get("checkedFrom") ?? undefined,
      checkedTo: url.searchParams.get("checkedTo") ?? undefined,
    });
    sendSuccess(ctx.res, 200, { records: records.map(serializeRecord) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleGetRecord(ctx: RouteContext, id: string): Promise<void> {
  try {
    const actor = await requireDataVaultActor(ctx.req, ctx.container);
    const record = await ctx.container.dataVault.getRecord(toActorContext(actor, ctx.req), id);
    sendSuccess(ctx.res, 200, { record: serializeRecord(record) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleCreateRecord(ctx: RouteContext): Promise<void> {
  try {
    const actor = await requireDataVaultActor(ctx.req, ctx.container);
    const body = await readJsonBody<Record<string, unknown>>(ctx.req);
    // Explicit allowlist — mass-assignment defence (PR brief item 18): id,
    // status, recordCode, createdBy, and every audit/version field are
    // server-assigned only and never read from the request body.
    const input: CreateDataVaultRecordInput = {
      legalEntityId: String(body.legalEntityId ?? ""),
      jurisdiction: String(body.jurisdiction ?? ""),
      category: String(body.category ?? ""),
      topic: String(body.topic ?? ""),
      source: String(body.source ?? ""),
      tier: String(body.tier ?? ""),
      confidence: String(body.confidence ?? ""),
      checkedDate: typeof body.checkedDate === "string" ? body.checkedDate : null,
      classification: (typeof body.classification === "string" ? body.classification : "INTERNAL") as DataClassification,
    };
    const record = await ctx.container.dataVault.createRecord(toActorContext(actor, ctx.req), input);
    sendSuccess(ctx.res, 201, { record: serializeRecord(record) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleUpdateRecord(ctx: RouteContext, id: string): Promise<void> {
  try {
    const actor = await requireDataVaultActor(ctx.req, ctx.container);
    const body = await readJsonBody<Record<string, unknown>>(ctx.req);
    const input: UpdateDataVaultRecordInput = {};
    if (typeof body.legalEntityId === "string") input.legalEntityId = body.legalEntityId;
    if (typeof body.jurisdiction === "string") input.jurisdiction = body.jurisdiction;
    if (typeof body.category === "string") input.category = body.category;
    if (typeof body.topic === "string") input.topic = body.topic;
    if (typeof body.source === "string") input.source = body.source;
    if (typeof body.tier === "string") input.tier = body.tier;
    if (typeof body.confidence === "string") input.confidence = body.confidence;
    if (body.checkedDate === null || typeof body.checkedDate === "string") input.checkedDate = body.checkedDate;
    if (typeof body.classification === "string") {
      if (!VALID_CLASSIFICATIONS.has(body.classification)) {
        return sendError(ctx.res, 400, "VALIDATION_ERROR", "classification is invalid.", ctx.correlationId);
      }
      input.classification = body.classification as DataClassification;
    }
    if (typeof body.status === "string") {
      if (!VALID_STATUSES.has(body.status)) {
        return sendError(ctx.res, 400, "VALIDATION_ERROR", "status is invalid.", ctx.correlationId);
      }
      input.status = body.status as DataVaultStatus;
    }
    if (typeof body.changeNote === "string") input.changeNote = body.changeNote;

    const record = await ctx.container.dataVault.updateRecord(toActorContext(actor, ctx.req), id, input);
    sendSuccess(ctx.res, 200, { record: serializeRecord(record) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleArchiveRecord(ctx: RouteContext, id: string): Promise<void> {
  try {
    const actor = await requireDataVaultActor(ctx.req, ctx.container);
    const record = await ctx.container.dataVault.archiveRecord(toActorContext(actor, ctx.req), id);
    sendSuccess(ctx.res, 200, { record: serializeRecord(record) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleListLegalEntities(ctx: RouteContext): Promise<void> {
  try {
    // Authentication only — which legal entities exist is basic reference
    // data (name/jurisdiction/currency), not itself classification-bearing,
    // and the create-record form needs it to populate the "Legal Entity"
    // field. No Data Vault permission is required to read this list.
    await requireDataVaultActor(ctx.req, ctx.container);
    const entities = await ctx.container.organisation.listLegalEntities();
    sendSuccess(
      ctx.res,
      200,
      { legalEntities: entities.map((e) => ({ id: e.id, key: e.key, name: e.name, jurisdiction: e.jurisdiction })) },
      ctx.correlationId,
    );
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}
