/**
 * Calendar provider token encryption — AES-256-GCM, server-side only.
 *
 * Provider-neutral: used for Google today, and will be reused unchanged for
 * Outlook's access/refresh tokens later (same table shape, same key). Keyed
 * by EXECUTIVE_VAULT_TOKEN_ENCRYPTION_KEY (32 raw bytes, base64), generated
 * the same way the repo's other at-rest encryption keys are
 * (`openssl rand -base64 32`) — see .env.example.
 *
 * A token is NEVER stored, logged, or returned to the frontend in plaintext
 * anywhere in this codebase; every calendar_connections read/write goes
 * through encryptToken()/decryptToken() below.
 */
const te = new TextEncoder();
const td = new TextDecoder();

function b64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}
function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function importKey(base64Key: string): Promise<CryptoKey> {
  const raw = fromB64(base64Key);
  if (raw.length !== 32) throw new Error("EXECUTIVE_VAULT_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (openssl rand -base64 32).");
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** Encrypts a plaintext token for storage. Returns "ivBase64.ciphertextBase64" — a single TEXT column value. */
export async function encryptToken(plaintext: string, base64Key: string): Promise<string> {
  const key = await importKey(base64Key);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit GCM nonce, unique per encryption
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, te.encode(plaintext));
  return `${b64(iv)}.${b64(new Uint8Array(ciphertext))}`;
}

/** Decrypts a value produced by encryptToken(). Throws if the key is wrong or the value is malformed/tampered — callers treat that as "re-authorisation required", never as a crash. */
export async function decryptToken(stored: string, base64Key: string): Promise<string> {
  const key = await importKey(base64Key);
  const dot = stored.indexOf(".");
  if (dot <= 0) throw new Error("Malformed encrypted token value.");
  const iv = fromB64(stored.slice(0, dot));
  const ciphertext = fromB64(stored.slice(dot + 1));
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return td.decode(plaintext);
}
