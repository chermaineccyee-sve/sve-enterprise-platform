/**
 * Resolves the authenticated actor for /api/v1/data-vault/* routes, and —
 * for the transitional SVEGIP-cookie authentication path only — enforces
 * an explicit Origin/Referer check on state-changing requests. See
 * docs/architecture/data-vault-foundation.md "CSRF/origin protection for
 * the SVEGIP cookie bridge" for the full design and the actual SVEGIP
 * cookie-issuance findings this is based on.
 *
 * Tries, in order:
 *   1. A native Identity bearer session token (Authorization: Bearer ...).
 *      CSRF/origin checking does NOT apply to this path: a bearer token is
 *      never attached automatically by a browser to a request it didn't
 *      construct, so cross-site request forgery is not the relevant
 *      threat model here — applying the check anyway would be pure
 *      friction with no security benefit, which is why this function
 *      tags the result with `authMethod` and the check is conditioned on
 *      it, never applied blindly to every request.
 *   2. The transitional SVEGIP session-cookie bridge (identity's
 *      verifySvegipSessionCookie + a `users` lookup by the verified
 *      email — see platform-services/identity/src/services/
 *      svegipSessionBridge.ts). Because this path IS cookie-based, and
 *      apps/svegip's cookie carries no CSRF token of its own, an explicit
 *      Origin/Referer check runs for every unsafe method (POST/PUT/PATCH/
 *      DELETE) BEFORE any user lookup or RBAC evaluation — a rejected
 *      origin throws immediately, so it is structurally impossible for a
 *      failed check to reach dataVaultService's create/update/archive
 *      methods.
 * Neither path trusts any client-supplied role, entity, or permission
 * claim from the request body or headers.
 */
import type { IncomingMessage } from "node:http";
import type { DataVaultContainer } from "../../composition/container.ts";
import { SessionInvalidError, IdentityNotProvisionedError, AccountDisabledError } from "../../../../identity/src/domain/errors.ts";
import { verifySvegipSessionCookie } from "../../../../identity/src/services/svegipSessionBridge.ts";
import { CsrfOriginRejectedError } from "../../domain/errors.ts";

export type DataVaultAuthMethod = "bearer" | "svegip-cookie";

export interface DataVaultActor {
  userId: string;
  email: string;
  authMethod: DataVaultAuthMethod;
}

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * The Origin an unsafe cross-origin fetch/XHR always carries, falling
 * back to Referer's origin for the rare legitimate client that omits
 * Origin on a same-origin request. Returns null (never throws) if
 * neither header is present or Referer is unparsable — a null result is
 * always treated as untrusted (default-deny), never as "no check needed".
 */
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

function assertTrustedOriginForCookieAuthenticatedWrite(req: IncomingMessage, container: DataVaultContainer): void {
  const method = (req.method ?? "GET").toUpperCase();
  if (!UNSAFE_METHODS.has(method)) return; // GET/HEAD (and other safe methods): no state change, no check needed.
  const origin = extractRequestOrigin(req);
  if (!origin || !container.trustedOrigins.has(origin)) {
    throw new CsrfOriginRejectedError();
  }
}

export async function requireDataVaultActor(req: IncomingMessage, container: DataVaultContainer): Promise<DataVaultActor> {
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
      // CSRF/origin check runs before any user lookup or RBAC evaluation —
      // a rejected origin never reaches dataVaultService.
      assertTrustedOriginForCookieAuthenticatedWrite(req, container);
      const user = await container.users.findByEmail(verified.email);
      if (!user) throw new IdentityNotProvisionedError();
      if (user.status !== "active") throw new AccountDisabledError();
      return { userId: user.id, email: user.email, authMethod: "svegip-cookie" };
    }
  }

  throw new SessionInvalidError("not_found");
}
