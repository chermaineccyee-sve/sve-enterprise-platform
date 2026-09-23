/**
 * Executive Command Centre Login — shared crypto/session helpers.
 *
 * This is Layer 1 only (docs/architecture/executive-command-centre-authentication.md):
 * "am I the authorised user of my own Command Centre." It has nothing to do
 * with the future Layer 2 (Microsoft Account Connection / Outlook OAuth,
 * docs/architecture/outlook-calendar-readiness-review.md) — that is a
 * separate, later grant against Microsoft Graph, never a password, and
 * never handled by this module.
 *
 * Same primitives apps/svegip's netlify/functions/{login,session,
 * bootstrap-admin}.mts already use in this exact Netlify Functions runtime
 * (Web Crypto's PBKDF2/HMAC, no extra dependency): a PBKDF2-SHA256 password
 * hash (verified against a per-account salt+hash+iteration count stored in
 * command_centre_users, never a bare shared secret) and an HMAC-SHA256
 * signed session cookie. Reused as an actual shared module (svegip inlines
 * the same logic per-file) since login/session/logout/bootstrap-user all
 * need it identically.
 */
const te = new TextEncoder();
export const COOKIE_NAME = "execvault_session";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours — matches SVEGIP's existing session lifetime

// Standard base64 (with padding) — used only for the password salt/hash at
// rest, exactly like svegip's bootstrap-admin.mts hp()/login.mts verify().
function b64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}
function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

// URL-safe base64 (no padding) — used for the session cookie's
// payload/signature, exactly like svegip's login.mts b64url()/from64(), and
// reused (exported) by _calendar-state.mts for the OAuth state nonce — same
// primitive, same server-only secret domain, no reason for a second copy.
export function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function fromB64url(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const withPad = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  return Uint8Array.from(atob(withPad), (c) => c.charCodeAt(0));
}

export interface PasswordHash {
  salt: string;
  hash: string;
  iterations: number;
}

/** Hashes a new password for storage. Only ever called from bootstrap-user.mts. */
export async function hashPassword(password: string): Promise<PasswordHash> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 210000;
  const key = await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return { salt: b64(salt), hash: b64(new Uint8Array(bits)), iterations };
}

/** Verifies a login attempt's password against the stored salt/hash. */
export async function verifyPasswordHash(password: string, saltB64: string, expectedHashB64: string, iterations: number): Promise<boolean> {
  const key = await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromB64(saltB64), iterations }, key, 256);
  const a = new Uint8Array(bits);
  const b = fromB64(expectedHashB64);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export interface SessionPayload {
  email: string;
  name: string;
  exp: number;
}

/** Exported for _calendar-state.mts's OAuth state nonce — same HMAC-SHA256 primitive, no second implementation. */
export async function hmacSign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", te.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, te.encode(payload))));
}
export async function hmacVerify(payload: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey("raw", te.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  try {
    return await crypto.subtle.verify("HMAC", key, fromB64url(signature), te.encode(payload));
  } catch {
    return false;
  }
}

/** Signs a new session cookie value (not the full Set-Cookie header — see sessionSetCookieHeader). */
export async function signSessionCookie(user: { email: string; name: string }, secret: string): Promise<string> {
  const payload: SessionPayload = { email: user.email, name: user.name, exp: Date.now() + SESSION_TTL_MS };
  const encodedPayload = b64url(te.encode(JSON.stringify(payload)));
  const signature = await hmacSign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

/** Verifies a raw cookie header value and returns the decoded payload, or null if absent/invalid/expired. */
export async function verifySessionCookie(cookieHeader: string | null, secret: string): Promise<SessionPayload | null> {
  const token = (cookieHeader || "").match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`))?.[1];
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!payload || !signature) return null;
  if (!(await hmacVerify(payload, signature, secret))) return null;
  try {
    const decoded = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as SessionPayload;
    if (!decoded?.email || typeof decoded.exp !== "number" || decoded.exp <= Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function sessionSetCookieHeader(cookieValue: string): string {
  return `${COOKIE_NAME}=${cookieValue}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`;
}
export function sessionClearCookieHeader(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
