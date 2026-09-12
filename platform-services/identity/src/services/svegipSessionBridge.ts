/**
 * SVEGIP session compatibility adapter — the "minimum safe integration
 * strategy" for authenticating Data Vault API requests during the
 * transitional state where apps/svegip still owns login (see PR brief
 * item 8; full write-up in docs/architecture/data-vault-foundation.md
 * "SVEGIP/Identity transitional authentication boundary").
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
 *    for the request is decided solely by this service's own RBAC
 *    tables (rbacService.ts, entity_access_grants, permissions) via a
 *    corresponding `users` row looked up by that email — see
 *    src/api/middleware/dataVaultActor.ts.
 *  - apps/svegip's own login/session issuance/password storage are not
 *    read, written, or modified by any code here.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "svegip_session";
export const SVEGIP_BRIDGE_SECRET_ENV_VAR = "SVEGIP_SESSION_SECRET";

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
