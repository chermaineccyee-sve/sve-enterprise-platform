/**
 * /api/v1/auth/mfa/* — enrolment and management for an already-authenticated
 * session (distinct from the login-time challenge in routes/auth.ts).
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Container } from "../../container.ts";
import { sendSuccess, sendError, readJsonBody } from "../middleware/envelope.ts";
import { requireSession, clientIp } from "../middleware/authContext.ts";
import { SessionInvalidError, MfaVerificationError, MfaAlreadyActiveError } from "../../domain/errors.ts";

interface RouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  container: Container;
  correlationId: string;
}

export async function handleBeginEnrolment(ctx: RouteContext): Promise<void> {
  try {
    const session = await requireSession(ctx.req, ctx.container);
    const user = await ctx.container.users.findById(session.userId);
    if (!user) return sendError(ctx.res, 401, "SESSION_INVALID", "Not authenticated.", ctx.correlationId);
    const enrolment = await ctx.container.mfa.beginEnrolment({ userId: user.id, accountEmail: user.email });
    await ctx.container.audit.record({ actorUserId: user.id, actorEmail: user.email, action: "mfa.enrolment_started", resourceType: "mfa_methods", resourceId: enrolment.methodId, sourceIp: clientIp(ctx.req) });
    // secretBase32/otpauthUri returned exactly once, here — never re-returned by any other endpoint.
    sendSuccess(ctx.res, 200, enrolment, ctx.correlationId);
  } catch (error) {
    if (error instanceof SessionInvalidError) return sendError(ctx.res, 401, "SESSION_INVALID", "Not authenticated.", ctx.correlationId);
    if (error instanceof MfaAlreadyActiveError) return sendError(ctx.res, 409, "MFA_ALREADY_ACTIVE", "An MFA method is already active or pending.", ctx.correlationId);
    throw error;
  }
}

export async function handleVerifyEnrolment(ctx: RouteContext): Promise<void> {
  let body: { methodId?: string; code?: string };
  try {
    body = await readJsonBody(ctx.req);
  } catch {
    return sendError(ctx.res, 400, "INVALID_REQUEST", "Invalid request body.", ctx.correlationId);
  }
  if (!body.methodId || !body.code) {
    return sendError(ctx.res, 400, "INVALID_REQUEST", "methodId and code are required.", ctx.correlationId);
  }
  try {
    const session = await requireSession(ctx.req, ctx.container);
    // completeEnrolment decrypts the stored secret internally — the client
    // is never asked to echo its own copy back for verification.
    await ctx.container.mfa.completeEnrolment({ userId: session.userId, methodId: body.methodId, code: body.code });
    const codes = await ctx.container.mfa.generateRecoveryCodes(session.userId);
    const user = await ctx.container.users.findById(session.userId);
    await ctx.container.audit.record({ actorUserId: session.userId, actorEmail: user?.email ?? null, action: "mfa.enrolment_verified", resourceType: "mfa_methods", resourceId: body.methodId, sourceIp: clientIp(ctx.req) });
    // Recovery codes are returned exactly once, here, immediately after enrolment.
    sendSuccess(ctx.res, 200, { activated: true, recoveryCodes: codes }, ctx.correlationId);
  } catch (error) {
    if (error instanceof SessionInvalidError) return sendError(ctx.res, 401, "SESSION_INVALID", "Not authenticated.", ctx.correlationId);
    if (error instanceof MfaVerificationError) return sendError(ctx.res, 401, "MFA_INVALID", "Invalid verification code.", ctx.correlationId);
    throw error;
  }
}

export async function handleRegenerateRecoveryCodes(ctx: RouteContext): Promise<void> {
  try {
    const session = await requireSession(ctx.req, ctx.container);
    const codes = await ctx.container.mfa.generateRecoveryCodes(session.userId);
    const user = await ctx.container.users.findById(session.userId);
    await ctx.container.audit.record({ actorUserId: session.userId, actorEmail: user?.email ?? null, action: "mfa.recovery_codes_regenerated", resourceType: "mfa_recovery_codes", sourceIp: clientIp(ctx.req) });
    sendSuccess(ctx.res, 200, { recoveryCodes: codes }, ctx.correlationId);
  } catch (error) {
    if (error instanceof SessionInvalidError) return sendError(ctx.res, 401, "SESSION_INVALID", "Not authenticated.", ctx.correlationId);
    throw error;
  }
}

export async function handleDisableMfa(ctx: RouteContext): Promise<void> {
  try {
    const session = await requireSession(ctx.req, ctx.container);
    const method = await ctx.container.mfa.getActiveOrPendingMethod(session.userId);
    if (!method) return sendError(ctx.res, 404, "NOT_FOUND", "No MFA method is enrolled.", ctx.correlationId);
    // Self-disable only in this foundation. An administrator-initiated MFA
    // reset for another user is a step-up-gated future action (see item 11
    // / docs/architecture/identity-foundation.md "Step-up authentication"),
    // not exposed here.
    await ctx.container.mfa.disable({ methodId: method.id, disabledBy: session.userId });
    const user = await ctx.container.users.findById(session.userId);
    await ctx.container.audit.record({ actorUserId: session.userId, actorEmail: user?.email ?? null, action: "mfa.disabled", resourceType: "mfa_methods", resourceId: method.id, sourceIp: clientIp(ctx.req) });
    sendSuccess(ctx.res, 200, { ok: true }, ctx.correlationId);
  } catch (error) {
    if (error instanceof SessionInvalidError) return sendError(ctx.res, 401, "SESSION_INVALID", "Not authenticated.", ctx.correlationId);
    throw error;
  }
}
