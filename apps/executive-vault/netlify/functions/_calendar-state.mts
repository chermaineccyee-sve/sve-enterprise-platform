/**
 * OAuth `state` parameter — signed and short-lived, so calendar-connect.mts
 * and calendar-google-callback.mts can prove a callback belongs to the
 * Executive Vault session that started it, without a second secret: reuses
 * EXECUTIVE_VAULT_SESSION_SECRET and the same HMAC-SHA256/base64url
 * primitives _auth-core.mts already uses for the session cookie.
 *
 * Deliberately does NOT put the state in the redirect URI's query string —
 * Google's redirect_uri must match the registered value exactly, so all
 * per-request context (who started this, which provider, a CSRF nonce, an
 * expiry) travels inside this one signed `state` value instead.
 */
import { hmacSign, hmacVerify, b64url, fromB64url } from "./_auth-core.mts";

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes — long enough for a real consent flow, short enough to bound replay risk

export interface OAuthStatePayload {
  email: string;    // the Executive Vault account that started this connection
  provider: string; // "google" today
  nonce: string;
  exp: number;
}

/** Signs a new state value for the given (already-authenticated) user + provider. */
export async function signOAuthState(email: string, provider: string, secret: string): Promise<string> {
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const payload: OAuthStatePayload = { email, provider, nonce, exp: Date.now() + STATE_TTL_MS };
  const encodedPayload = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await hmacSign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

/** Verifies a state value returned by Google. Returns the decoded payload, or null if missing/tampered/expired — the callback treats any of those identically (reject, ask to reconnect), never distinguishing why to the frontend. */
export async function verifyOAuthState(state: string | null, secret: string): Promise<OAuthStatePayload | null> {
  if (!state) return null;
  const dot = state.lastIndexOf(".");
  if (dot <= 0) return null;
  const encodedPayload = state.slice(0, dot);
  const signature = state.slice(dot + 1);
  if (!encodedPayload || !signature) return null;
  if (!(await hmacVerify(encodedPayload, signature, secret))) return null;
  try {
    const decoded = JSON.parse(new TextDecoder().decode(fromB64url(encodedPayload))) as OAuthStatePayload;
    if (!decoded?.email || !decoded?.provider || typeof decoded.exp !== "number" || decoded.exp <= Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}
