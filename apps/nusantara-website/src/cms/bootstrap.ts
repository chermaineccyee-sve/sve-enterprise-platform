import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * FIRST-ADMIN BOOTSTRAP — a deliberate, short window, never a standing
 * registration path.
 *
 *  1. Provision: set CMS_BOOTSTRAP_TOKEN (≥ 32 random characters) for the
 *     deployment and redeploy.
 *  2. At /admin/bootstrap, enter the token. Only while the database has NO
 *     accounts, a valid token sets a short-lived (15 min) HttpOnly cookie that
 *     unlocks Payload's create-first-user form once. The account is always an Admin.
 *  3. Verify: sign in as that Admin.
 *  4. Disable: remove CMS_BOOTSTRAP_TOKEN and redeploy. Even before that, the
 *     window is closed for good as soon as one account exists.
 *
 * Without the token (and the cookie it grants) nobody can create an account
 * anonymously. The alternative is the server-side `npm run cms:seed-admin`.
 */
export const BOOTSTRAP_COOKIE = "nusantara-bootstrap";
export const BOOTSTRAP_MAX_AGE = 15 * 60;

const token = () => process.env.CMS_BOOTSTRAP_TOKEN ?? "";
export const bootstrapConfigured = () => token().length >= 32;

/** Cookie value: an HMAC of the token, so the token itself is never stored in the browser. */
export const bootstrapCookieValue = () => createHmac("sha256", process.env.PAYLOAD_SECRET || "").update(`bootstrap:${token()}`).digest("hex");

const sameLength = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);
const digest = (s: string) => createHmac("sha256", "nusantara-bootstrap-compare").update(s).digest();

export const tokenMatches = (candidate: string) => bootstrapConfigured() && sameLength(digest(candidate), digest(token()));

export function hasBootstrapCookie(cookieHeader: string | null | undefined): boolean {
  if (!bootstrapConfigured() || !cookieHeader) return false;
  const v = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${BOOTSTRAP_COOKIE}=`))
    ?.slice(BOOTSTRAP_COOKIE.length + 1);
  return !!v && sameLength(Buffer.from(v), Buffer.from(bootstrapCookieValue()));
}
