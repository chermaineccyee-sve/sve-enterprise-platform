/**
 * Resolves the authenticated actor for this package's routes. Tries, in
 * order: a native Identity bearer session, then the transitional SVEGIP
 * session-cookie bridge — mirrors platform-services/organisation's own
 * middleware/actor.ts exactly (see that file's header comment for the
 * full CSRF/origin rationale), duplicated here rather than imported since
 * these sibling packages share no workspace/package boundary.
 */
import type { IncomingMessage } from "node:http";
import type { HrmsContainer } from "../../composition/container.ts";
import { SessionInvalidError, AccountDisabledError, IdentityNotProvisionedError } from "../../../../identity/src/domain/errors.ts";
import { verifySvegipSessionCookie } from "../../../../identity/src/services/svegipSessionBridge.ts";
import { CsrfOriginRejectedError } from "../../domain/errors.ts";

export type AuthMethod = "bearer" | "svegip-cookie";

export interface Actor {
  userId: string;
  email: string;
  authMethod: AuthMethod;
}

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function extractRequestOrigin(req: IncomingMessage): string | null {
  const origin = req.headers["origin"];
  if (typeof origin === "string" && origin.length > 0) return origin;
  const referer = req.headers["referer"];
  if (typeof referer === "string" && referer.length > 0) {
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }
  return null;
}

function assertTrustedOriginForCookieAuthenticatedWrite(req: IncomingMessage, container: HrmsContainer): void {
  const method = (req.method ?? "GET").toUpperCase();
  if (!UNSAFE_METHODS.has(method)) return;
  const origin = extractRequestOrigin(req);
  if (!origin || !container.trustedOrigins.has(origin)) {
    throw new CsrfOriginRejectedError();
  }
}

export async function requireActor(req: IncomingMessage, container: HrmsContainer): Promise<Actor> {
  const authHeader = req.headers["authorization"];
  const bearerMatch = typeof authHeader === "string" ? authHeader.match(/^Bearer (.+)$/) : null;
  if (bearerMatch) {
    const session = await container.sessions.validateSession(bearerMatch[1]!);
    const user = await container.users.findById(session.userId);
    if (!user) throw new SessionInvalidError("not_found");
    if (user.status !== "active") throw new AccountDisabledError();
    return { userId: user.id, email: user.email, authMethod: "bearer" };
  }

  if (container.svegipBridgeSecret) {
    const cookieHeader = req.headers["cookie"];
    const verified = verifySvegipSessionCookie(typeof cookieHeader === "string" ? cookieHeader : null, container.svegipBridgeSecret);
    if (verified) {
      assertTrustedOriginForCookieAuthenticatedWrite(req, container);
      const user = await container.users.findByEmail(verified.email);
      if (!user) throw new IdentityNotProvisionedError();
      if (user.status !== "active") throw new AccountDisabledError();
      return { userId: user.id, email: user.email, authMethod: "svegip-cookie" };
    }
  }

  throw new SessionInvalidError("not_found");
}

export function clientIp(req: IncomingMessage): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) return forwarded.split(",")[0]!.trim();
  return req.socket.remoteAddress ?? null;
}
