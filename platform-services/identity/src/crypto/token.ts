/**
 * Secure random token generation and one-way hashing for values that must be
 * looked up by hash but never stored reversibly: session bearer tokens and
 * MFA recovery codes. See docs/architecture/identity-foundation.md
 * "Session tokens" and "Recovery codes".
 *
 * SHA-256 (not a slow password-hashing KDF) is intentional here: these are
 * high-entropy random values (256-bit tokens, ~40-bit-per-group recovery
 * codes drawn from a large alphabet), not user-chosen passwords, so a fast
 * cryptographic hash is the correct tool — a slow KDF would just make every
 * session validation artificially expensive for no security benefit.
 */
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

/** A cryptographically random, URL-safe bearer token (256 bits of entropy). */
export function generateBearerToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 hex digest — used to store/lookup tokens without keeping the raw value. */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Constant-time comparison of two hex digests, to avoid timing side-channels. */
export function hashesEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * A human-typeable recovery code: groups of uppercase letters/digits
 * excluding visually ambiguous characters (0/O, 1/I/L), e.g. "7K4X-9QRT-2MPD".
 */
const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function generateRecoveryCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < 3; g++) {
    let group = "";
    const bytes = randomBytes(4);
    for (let i = 0; i < 4; i++) {
      group += RECOVERY_ALPHABET[(bytes[i] ?? 0) % RECOVERY_ALPHABET.length];
    }
    groups.push(group);
  }
  return groups.join("-");
}
