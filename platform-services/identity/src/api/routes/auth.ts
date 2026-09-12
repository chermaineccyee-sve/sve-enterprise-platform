/**
 * /api/v1/auth/* — login, MFA challenge completion, logout, and session
 * management. See docs/architecture/api-conventions.md for the envelope
 * and error-code conventions these follow.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Container } from "../../container.ts";
import { sendSuccess, sendError, readJsonBody } from "../middleware/envelope.ts";
import { requireSession, clientIp } from "../middleware/authContext.ts";
import { InvalidCredentialsError, AccountDisabledError, ThrottledError, SessionInvalidError, RecoveryCodeInvalidError } from "../../domain/errors.ts";

interface RouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  container: Container;
  correlationId: string;
}

async function establishSession(ctx: RouteContext, userId: string, mfaVerified: boolean, status = 200) {
  const created = await ctx.container.sessions.createSession({
    userId,
    mfaVerified,
    ip: clientIp(ctx.req),
    userAgent: (ctx.req.headers["user-agent"] as string) ?? null,
  });
  const user = await ctx.container.users.findById(userId);
  await ctx.container.audit.record({
    actorUserId: userId,
    actorEmail: user?.email ?? null,
    action: "session.created",
    resourceType: "session",
    resourceId: created.session.id,
    sessionId: created.session.id,
    sourceIp: clientIp(ctx.req),
  });
  sendSuccess(ctx.res, status, { sessionToken: created.token, expiresAt: created.session.expiresAt }, ctx.correlationId);
}

export async function handleLogin(ctx: RouteContext): Promise<void> {
  let body: { email?: string; password?: string };
  try {
    body = await readJsonBody(ctx.req);
  } catch {
    return sendError(ctx.res, 400, "INVALID_REQUEST", "Invalid request body.", ctx.correlationId);
  }
  if (!body.email || !body.password) {
    return sendError(ctx.res, 400, "INVALID_REQUEST", "Email and password are required.", ctx.correlationId);
  }
  try {
    const result = await ctx.container.auth.login({
      email: body.email,
      password: body.password,
      ip: clientIp(ctx.req) ?? undefined,
      userAgent: (ctx.req.headers["user-agent"] as string) ?? undefined,
    });
    if (result.outcome === "mfa_challenge") {
      await ctx.container.audit.record({
        actorUserId: result.userId ?? null,
        actorEmail: body.email.toLowerCase(),
        action: "auth.login.success",
        resourceType: "authentication",
        sourceIp: clientIp(ctx.req),
      });
      return sendSuccess(ctx.res, 200, { outcome: "mfa_challenge", challengeId: result.challengeId }, ctx.correlationId);
    }
    await ctx.container.audit.record({
      actorUserId: result.userId ?? null,
      actorEmail: body.email.toLowerCase(),
      action: "auth.login.success",
      resourceType: "authentication",
      sourceIp: clientIp(ctx.req),
    });
    await establishSession(ctx, result.userId!, false);
  } catch (error) {
    return handleLoginError(ctx, error, body.email);
  }
}

async function handleLoginError(ctx: RouteContext, error: unknown, email: string): Promise<void> {
  // Every failure branch below returns the SAME generic message and status —
  // this is deliberate (see docs/architecture/identity-foundation.md
  // "Account enumeration resistance"), not an oversight that some branches
  // are more specific than others.
  const GENERIC = "Invalid email or password.";
  if (error instanceof ThrottledError) {
    await ctx.container.audit.record({
      actorUserId: null,
      actorEmail: email.toLowerCase(),
      action: "auth.login.throttled",
      resourceType: "authentication",
      sourceIp: clientIp(ctx.req),
    });
    ctx.res.setHeader("Retry-After", String(error.retryAfterSeconds));
    return sendError(ctx.res, 429, "AUTH_THROTTLED", GENERIC, ctx.correlationId);
  }
  if (error instanceof InvalidCredentialsError || error instanceof AccountDisabledError) {
    await ctx.container.audit.record({
      actorUserId: null,
      actorEmail: email.toLowerCase(),
      action: "auth.login.failure",
      resourceType: "authentication",
      sourceIp: clientIp(ctx.req),
    });
    return sendError(ctx.res, 401, "INVALID_CREDENTIALS", GENERIC, ctx.correlationId);
  }
  throw error;
}

export async function handleMfaVerify(ctx: RouteContext): Promise<void> {
  let body: { challengeId?: string; code?: string };
  try {
    body = await readJsonBody(ctx.req);
  } catch {
    return sendError(ctx.res, 400, "INVALID_REQUEST", "Invalid request body.", ctx.correlationId);
  }
  if (!body.challengeId || !body.code) {
    return sendError(ctx.res, 400, "INVALID_REQUEST", "challengeId and code are required.", ctx.correlationId);
  }
  // Not consumed here — a wrong code must be retryable against the same
  // challenge (bounded by its own expiry and by throttling below), not
  // force the user back to re-entering their password on every mistype.
  // Consumed explicitly, below, only on successful verification.
  const userId = ctx.container.auth.peekChallenge(body.challengeId);
  if (!userId) return sendError(ctx.res, 401, "CHALLENGE_INVALID", "Challenge is invalid or has expired.", ctx.correlationId);

  // Defense-in-depth: re-check the account is still active. authService.login
  // already refuses to issue a challenge for a disabled account, but a
  // challengeId can be several minutes old — never trust that an
  // intermediate, in-memory state (the pending challenge) still reflects the
  // account's current status.
  const user = await ctx.container.users.findById(userId);
  if (!user || user.status !== "active") {
    return sendError(ctx.res, 401, "CHALLENGE_INVALID", "Challenge is invalid or has expired.", ctx.correlationId);
  }

  // The MFA step has its own brute-force surface (guessing a 6-digit code
  // or a recovery code) distinct from the password step — throttled the
  // same way, keyed on the account's email. See "Rate-limit semantics" in
  // docs/architecture/identity-foundation.md.
  const ip = clientIp(ctx.req) ?? undefined;
  const userAgent = (ctx.req.headers["user-agent"] as string) ?? undefined;
  const backoff = await ctx.container.rateLimiter.checkThrottle({ email: user.email, ip });
  if (backoff > 0) {
    await ctx.container.rateLimiter.recordFailure({ email: user.email, ip, userAgent, reason: "throttled" });
    ctx.res.setHeader("Retry-After", String(backoff));
    return sendError(ctx.res, 429, "AUTH_THROTTLED", "Too many attempts.", ctx.correlationId);
  }

  const method = await ctx.container.mfa.getActiveOrPendingMethod(userId);
  if (!method || method.status !== "active") {
    return sendError(ctx.res, 401, "CHALLENGE_INVALID", "Challenge is invalid or has expired.", ctx.correlationId);
  }
  const valid = await ctx.container.mfa.verifyChallenge({ userId, code: body.code });
  if (!valid) {
    await ctx.container.rateLimiter.recordFailure({ email: user.email, ip, userAgent, reason: "mfa_failed" });
    await ctx.container.audit.record({ actorUserId: userId, actorEmail: user.email, action: "mfa.challenge_failed", resourceType: "mfa_methods", resourceId: method.id, sourceIp: clientIp(ctx.req) });
    return sendError(ctx.res, 401, "MFA_INVALID", "Invalid verification code.", ctx.correlationId);
  }
  ctx.container.auth.consumeChallenge(body.challengeId);
  await ctx.container.rateLimiter.recordSuccess({ email: user.email, ip, userAgent });
  await ctx.container.audit.record({ actorUserId: userId, actorEmail: user.email, action: "mfa.challenge_verified", resourceType: "mfa_methods", resourceId: method.id, sourceIp: clientIp(ctx.req) });
  await establishSession(ctx, userId, true);
}

export async function handleMfaRecovery(ctx: RouteContext): Promise<void> {
  let body: { challengeId?: string; code?: string };
  try {
    body = await readJsonBody(ctx.req);
  } catch {
    return sendError(ctx.res, 400, "INVALID_REQUEST", "Invalid request body.", ctx.correlationId);
  }
  if (!body.challengeId || !body.code) {
    return sendError(ctx.res, 400, "INVALID_REQUEST", "challengeId and code are required.", ctx.correlationId);
  }
  // Not consumed here — see the identical comment in handleMfaVerify above.
  const userId = ctx.container.auth.peekChallenge(body.challengeId);
  if (!userId) return sendError(ctx.res, 401, "CHALLENGE_INVALID", "Challenge is invalid or has expired.", ctx.correlationId);

  // Defense-in-depth: see the identical check in handleMfaVerify above.
  const user = await ctx.container.users.findById(userId);
  if (!user || user.status !== "active") {
    return sendError(ctx.res, 401, "CHALLENGE_INVALID", "Challenge is invalid or has expired.", ctx.correlationId);
  }

  const ip = clientIp(ctx.req) ?? undefined;
  const userAgent = (ctx.req.headers["user-agent"] as string) ?? undefined;
  const backoff = await ctx.container.rateLimiter.checkThrottle({ email: user.email, ip });
  if (backoff > 0) {
    await ctx.container.rateLimiter.recordFailure({ email: user.email, ip, userAgent, reason: "throttled" });
    ctx.res.setHeader("Retry-After", String(backoff));
    return sendError(ctx.res, 429, "AUTH_THROTTLED", "Too many attempts.", ctx.correlationId);
  }

  try {
    await ctx.container.mfa.consumeRecoveryCode({ userId, code: body.code });
  } catch (error) {
    if (error instanceof RecoveryCodeInvalidError) {
      await ctx.container.rateLimiter.recordFailure({ email: user.email, ip, userAgent, reason: "recovery_code_invalid" });
      return sendError(ctx.res, 401, "RECOVERY_CODE_INVALID", "Recovery code is invalid or already used.", ctx.correlationId);
    }
    throw error;
  }
  ctx.container.auth.consumeChallenge(body.challengeId);
  await ctx.container.rateLimiter.recordSuccess({ email: user.email, ip, userAgent });
  await ctx.container.audit.record({ actorUserId: userId, actorEmail: user.email, action: "mfa.recovery_code_used", resourceType: "mfa_recovery_codes", sourceIp: clientIp(ctx.req) });
  await establishSession(ctx, userId, true);
}

export async function handleLogout(ctx: RouteContext): Promise<void> {
  try {
    const session = await requireSession(ctx.req, ctx.container);
    await ctx.container.sessions.revokeSession(session.id, "user_logout");
    const user = await ctx.container.users.findById(session.userId);
    await ctx.container.audit.record({ actorUserId: session.userId, actorEmail: user?.email ?? null, action: "auth.logout", resourceType: "session", resourceId: session.id, sessionId: session.id, sourceIp: clientIp(ctx.req) });
    sendSuccess(ctx.res, 200, { ok: true }, ctx.correlationId);
  } catch (error) {
    if (error instanceof SessionInvalidError) return sendError(ctx.res, 401, "SESSION_INVALID", "Not authenticated.", ctx.correlationId);
    throw error;
  }
}

export async function handleGetCurrentSession(ctx: RouteContext): Promise<void> {
  try {
    const session = await requireSession(ctx.req, ctx.container);
    // Never returns tokenHash — only fields safe to expose.
    sendSuccess(ctx.res, 200, {
      id: session.id,
      userId: session.userId,
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
      expiresAt: session.expiresAt,
      mfaVerified: session.mfaVerified,
    }, ctx.correlationId);
  } catch (error) {
    if (error instanceof SessionInvalidError) return sendError(ctx.res, 401, "SESSION_INVALID", "Not authenticated.", ctx.correlationId);
    throw error;
  }
}

export async function handleListSessions(ctx: RouteContext): Promise<void> {
  try {
    const session = await requireSession(ctx.req, ctx.container);
    const active = await ctx.container.sessions.listActiveSessions(session.userId);
    sendSuccess(
      ctx.res,
      200,
      active.map((s) => ({ id: s.id, createdAt: s.createdAt, lastActiveAt: s.lastActiveAt, expiresAt: s.expiresAt, ip: s.ip, userAgent: s.userAgent, isCurrent: s.id === session.id })),
      ctx.correlationId,
    );
  } catch (error) {
    if (error instanceof SessionInvalidError) return sendError(ctx.res, 401, "SESSION_INVALID", "Not authenticated.", ctx.correlationId);
    throw error;
  }
}

export async function handleRevokeAllSessions(ctx: RouteContext): Promise<void> {
  try {
    const session = await requireSession(ctx.req, ctx.container);
    const count = await ctx.container.sessions.revokeAllSessionsForUser(session.userId, "user_requested_revoke_all");
    const user = await ctx.container.users.findById(session.userId);
    await ctx.container.audit.record({ actorUserId: session.userId, actorEmail: user?.email ?? null, action: "session.revoked_all", resourceType: "session", sourceIp: clientIp(ctx.req) });
    sendSuccess(ctx.res, 200, { revokedCount: count }, ctx.correlationId);
  } catch (error) {
    if (error instanceof SessionInvalidError) return sendError(ctx.res, 401, "SESSION_INVALID", "Not authenticated.", ctx.correlationId);
    throw error;
  }
}

export async function handleRevokeOneSession(ctx: RouteContext, targetSessionId: string): Promise<void> {
  try {
    const session = await requireSession(ctx.req, ctx.container);
    // A user may only revoke their OWN sessions in this foundation — an
    // admin "revoke any user's session" capability is a future,
    // permission-gated addition, not exposed here (see item 14: don't
    // expose broad administrative APIs merely because the table exists).
    const active = await ctx.container.sessions.listActiveSessions(session.userId);
    const target = active.find((s) => s.id === targetSessionId);
    if (!target) return sendError(ctx.res, 404, "NOT_FOUND", "Session not found.", ctx.correlationId);
    await ctx.container.sessions.revokeSession(target.id, "user_requested_revoke");
    const user = await ctx.container.users.findById(session.userId);
    await ctx.container.audit.record({ actorUserId: session.userId, actorEmail: user?.email ?? null, action: "session.revoked", resourceType: "session", resourceId: target.id, sourceIp: clientIp(ctx.req) });
    sendSuccess(ctx.res, 200, { ok: true }, ctx.correlationId);
  } catch (error) {
    if (error instanceof SessionInvalidError) return sendError(ctx.res, 401, "SESSION_INVALID", "Not authenticated.", ctx.correlationId);
    throw error;
  }
}
