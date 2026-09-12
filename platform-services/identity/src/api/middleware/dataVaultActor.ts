/**
 * Resolves the authenticated actor for /api/v1/data-vault/* routes.
 * Tries, in order:
 *   1. A native Identity bearer session token (Authorization: Bearer ...),
 *      exactly like every other route in this service.
 *   2. The transitional SVEGIP session-cookie bridge (see
 *      src/services/svegipSessionBridge.ts) — verifies the cookie's
 *      signature, then looks up a corresponding `users` row by the
 *      verified email in THIS service's own database. Authorization for
 *      the rest of the request is decided entirely from that row's own
 *      role/entity-access grants (rbacService.ts) — nothing from the
 *      SVEGIP cookie itself (its embedded role/unit/permissions) is ever
 *      consulted. See docs/architecture/data-vault-foundation.md.
 * Neither path trusts any client-supplied role, entity, or permission
 * claim from the request body or headers.
 */
import type { IncomingMessage } from "node:http";
import type { Container } from "../../container.ts";
import { SessionInvalidError, IdentityNotProvisionedError, AccountDisabledError } from "../../domain/errors.ts";
import { verifySvegipSessionCookie } from "../../services/svegipSessionBridge.ts";

export interface DataVaultActor {
  userId: string;
  email: string;
}

export async function requireDataVaultActor(req: IncomingMessage, container: Container): Promise<DataVaultActor> {
  const authHeader = req.headers["authorization"];
  const bearerMatch = typeof authHeader === "string" ? authHeader.match(/^Bearer (.+)$/) : null;
  if (bearerMatch) {
    const session = await container.sessions.validateSession(bearerMatch[1]!);
    const user = await container.users.findById(session.userId);
    if (!user) throw new SessionInvalidError("not_found");
    if (user.status !== "active") throw new AccountDisabledError();
    return { userId: user.id, email: user.email };
  }

  if (container.svegipBridgeSecret) {
    const cookieHeader = req.headers["cookie"];
    const verified = verifySvegipSessionCookie(typeof cookieHeader === "string" ? cookieHeader : null, container.svegipBridgeSecret);
    if (verified) {
      const user = await container.users.findByEmail(verified.email);
      if (!user) throw new IdentityNotProvisionedError();
      if (user.status !== "active") throw new AccountDisabledError();
      return { userId: user.id, email: user.email };
    }
  }

  throw new SessionInvalidError("not_found");
}
