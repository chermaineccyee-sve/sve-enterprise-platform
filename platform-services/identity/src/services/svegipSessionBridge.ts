/**
 * SVEGIP session compatibility adapter — a reusable Identity capability
 * (verify an externally-issued SVEGIP session, resolve it to nothing more
 * than a verified email) that any consuming platform-service can depend
 * on during the transitional state where apps/svegip still owns login.
 * Data Vault is the current consumer (see docs/architecture/
 * data-vault-foundation.md "SVEGIP/Identity transitional authentication
 * boundary" and platform-services/data-vault/src/api/middleware/
 * dataVaultActor.ts) — this module itself has no Data-Vault-specific
 * knowledge, and Identity does not depend on Data Vault to use it.
 *
 * What this does and does not trust:
 *  - It cryptographically verifies the exact same signed cookie apps/
 *    svegip/netlify/functions/login.mts issues and _auth-core.mts
 *    verifies (HMAC-SHA256 over the base64url payload string, keyed by
 *    the shared SVEGIP_SESSION_SECRET) — the identical trust boundary
 *    SVEGIP itself already relies on, not a new or weaker one.
 *  - It extracts ONLY the verified email and expiry from that cookie.
 *    The role/unit/permissions/dataVaultAccess fields embedded in the
 *    cookie are deliberately never read here — they are SVEGIP's own
 *    authorization state, not this platform's, and trusting them would
 *    recreate "two unrelated sources of authority" for the same
 *    decision. Once this returns a verified email, all authorization
 *    for the request must be decided solely by the consuming service's
 *    own RBAC tables via a corresponding `users` row looked up by that
 *    email — never from this cookie again.
 *  - apps/svegip's own login/session issuance/password storage are not
 *    read, written, or modified by any code here.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SecretsProvider } from "../../../../packages/security/src/SecretsProvider.ts";

const COOKIE_NAME = "svegip_session";
export const SVEGIP_BRIDGE_SECRET_ENV_VAR = "SVEGIP_SESSION_SECRET";

/**
 * Resolves the shared bridge secret through the SecretsProvider
 * abstraction (never a direct process.env read outside src/config/
 * envSecretsProvider.ts), or null if unset. Unlike loadMfaEncryptionKey,
 * this never throws on a missing value — the bridge is optional
 * (consuming services must decide whether to enable it), so "not
 * configured" is a normal, valid outcome, not a startup failure.
 */
export async function loadSvegipBridgeSecret(secrets: SecretsProvider): Promise<string | null> {
  const value = await secrets.getSecret(SVEGIP_BRIDGE_SECRET_ENV_VAR);
  return value && value.length > 0 ? value : null;
}

function fromBase64Url(value: string): Buffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const withPadding = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  return Buffer.from(withPadding, "base64");
}

export interface VerifiedSvegipIdentity {
  email: string;
}

/**
 * Verifies a `svegip_session` cookie value against the shared secret and
 * returns the verified email, or null if the cookie is absent, malformed,
 * incorrectly signed, or expired. Never throws on attacker-controlled
 * input — every failure path returns null so callers uniformly treat it
 * as "not authenticated via this bridge" (see requireDataVaultActor).
 */
export function verifySvegipSessionCookie(cookieHeader: string | undefined | null, secret: string): VerifiedSvegipIdentity | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  const token = match?.[1];
  if (!token) return null;

  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex <= 0) return null;
  const payload = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  if (!payload || !signature) return null;

  let expectedSignature: Buffer;
  let providedSignature: Buffer;
  try {
    expectedSignature = createHmac("sha256", secret).update(payload, "utf8").digest();
    providedSignature = fromBase64Url(signature);
  } catch {
    return null;
  }
  if (expectedSignature.length !== providedSignature.length || !timingSafeEqual(expectedSignature, providedSignature)) {
    return null;
  }

  try {
    const decoded = JSON.parse(fromBase64Url(payload).toString("utf8")) as { email?: unknown; exp?: unknown };
    if (typeof decoded.email !== "string" || !decoded.email) return null;
    if (typeof decoded.exp !== "number" || decoded.exp <= Date.now()) return null;
    return { email: decoded.email.trim().toLowerCase() };
  } catch {
    return null;
  }
}
