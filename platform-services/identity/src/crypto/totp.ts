/**
 * RFC 6238 TOTP (built on RFC 4226 HOTP), via Node's built-in HMAC — no
 * external authenticator library. SHA-1 is used deliberately, not as a
 * general-purpose hash choice but because it is what RFC 6238 specifies and
 * what virtually every standards-compatible authenticator app (Google
 * Authenticator, Authy, 1Password, etc.) expects for interoperability; this
 * is a keyed 30-second one-time-code derivation, not a use of SHA-1 for
 * general password/data hashing. See docs/architecture/
 * identity-foundation.md "MFA — TOTP" for the full rationale.
 */
import { createHmac, randomBytes } from "node:crypto";
import { base32Encode } from "./base32.ts";

const STEP_SECONDS = 30;
const DIGITS = 6;

export function generateTotpSecret(): { secret: Uint8Array; base32: string } {
  const secret = randomBytes(20); // 160 bits, standard HOTP/TOTP key size
  return { secret, base32: base32Encode(secret) };
}

/** Exported for RFC 4226 test-vector verification; TOTP callers use generateTotp/verifyTotp. */
export function hotp(secret: Uint8Array, counter: bigint): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter);
  const hmac = createHmac("sha1", Buffer.from(secret)).update(counterBuffer).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const binCode =
    ((hmac[offset] ?? 0) & 0x7f) << 24 |
    ((hmac[offset + 1] ?? 0) & 0xff) << 16 |
    ((hmac[offset + 2] ?? 0) & 0xff) << 8 |
    ((hmac[offset + 3] ?? 0) & 0xff);
  return String(binCode % 10 ** DIGITS).padStart(DIGITS, "0");
}

function currentStep(atSeconds: number): bigint {
  return BigInt(Math.floor(atSeconds / STEP_SECONDS));
}

export function generateTotp(secret: Uint8Array, atSeconds: number = Date.now() / 1000): string {
  return hotp(secret, currentStep(atSeconds));
}

/**
 * Verifies a code allowing +/-1 step (30s) of clock drift, per common TOTP
 * practice. Returns which step matched (for future replay-prevention if a
 * caller wants to record "last accepted step"), or null if invalid.
 */
export function verifyTotp(
  secret: Uint8Array,
  code: string,
  atSeconds: number = Date.now() / 1000,
  windowSteps = 1,
): { valid: boolean; matchedStep: bigint | null } {
  const normalized = code.trim();
  if (!/^\d{6}$/.test(normalized)) return { valid: false, matchedStep: null };
  const step = currentStep(atSeconds);
  for (let delta = -windowSteps; delta <= windowSteps; delta++) {
    const candidateStep = step + BigInt(delta);
    if (hotp(secret, candidateStep) === normalized) {
      return { valid: true, matchedStep: candidateStep };
    }
  }
  return { valid: false, matchedStep: null };
}

/** otpauth:// URI for QR-code enrolment, per Google Authenticator's key URI format. */
export function buildOtpauthUri(params: {
  secretBase32: string;
  accountName: string; // typically the user's email
  issuer: string; // e.g. "SVE Enterprise Platform"
}): string {
  const label = encodeURIComponent(`${params.issuer}:${params.accountName}`);
  const query = new URLSearchParams({
    secret: params.secretBase32,
    issuer: params.issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}
