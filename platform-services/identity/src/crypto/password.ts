/**
 * Password hashing for the new Identity foundation — independent of
 * apps/svegip's existing PBKDF2-SHA256 implementation (unchanged, left as
 * the compatibility/reference implementation per the PR brief).
 *
 * Algorithm: scrypt (RFC 7914), via Node's built-in `node:crypto` — no
 * external dependency, no invented cryptography. Parameters follow Node's
 * own documented recommended defaults (N=16384, r=8, p=1), derived-key
 * length 64 bytes, random 16-byte salt per password. See
 * docs/architecture/identity-foundation.md "Password hashing" for the
 * rationale (scrypt is memory-hard, which PBKDF2 is not; chosen to give the
 * new foundation a stronger default from the start, not because SVEGIP's
 * existing PBKDF2 choice was wrong for its own purposes).
 *
 * Parameters are stored per-credential-row (see user_credentials.
 * password_params in the migration), not hard-coded only here, so future
 * parameter increases don't invalidate already-stored hashes until they are
 * next rehashed.
 */
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

// A hand-written Promise wrapper, not util.promisify: promisify's typings
// resolve scrypt's options-taking overload ambiguously (a real tsc error,
// not a style preference), so this is the correct fix, not a workaround.
function scrypt(password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export interface ScryptParams {
  N: number;
  r: number;
  p: number;
  keylen: number;
}

export const DEFAULT_SCRYPT_PARAMS: ScryptParams = { N: 16384, r: 8, p: 1, keylen: 64 };

export interface PasswordHash {
  algorithm: "scrypt";
  hash: string; // base64
  salt: string; // base64
  params: ScryptParams;
}

export async function hashPassword(
  password: string,
  params: ScryptParams = DEFAULT_SCRYPT_PARAMS,
): Promise<PasswordHash> {
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize("NFKC"), salt, params.keylen, {
    N: params.N,
    r: params.r,
    p: params.p,
  });
  return {
    algorithm: "scrypt",
    hash: derived.toString("base64"),
    salt: salt.toString("base64"),
    params,
  };
}

export async function verifyPassword(
  password: string,
  stored: { hash: string; salt: string; params: ScryptParams },
): Promise<boolean> {
  const salt = Buffer.from(stored.salt, "base64");
  const expected = Buffer.from(stored.hash, "base64");
  const derived = await scrypt(password.normalize("NFKC"), salt, stored.params.keylen, {
    N: stored.params.N,
    r: stored.params.r,
    p: stored.params.p,
  });
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
