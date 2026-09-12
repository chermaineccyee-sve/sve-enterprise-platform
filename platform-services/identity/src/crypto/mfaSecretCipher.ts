/**
 * Application-layer authenticated encryption for stored TOTP secrets.
 * AES-256-GCM via Node's built-in `node:crypto` — no external dependency,
 * no invented cryptography. Fixes a review finding: `mfa_methods` previously
 * stored the base32 TOTP secret as plaintext despite the column/field name
 * implying otherwise. See docs/architecture/identity-foundation.md
 * "MFA secret encryption at rest".
 *
 * Key handling: the raw 256-bit key is never hard-coded or committed. It is
 * resolved through `packages/security`'s SecretsProvider contract (see
 * src/config/envSecretsProvider.ts for the concrete local/private-server
 * implementation, reading SVE_IDENTITY_MFA_ENCRYPTION_KEY from the
 * environment) — a future AWS deployment supplies the same key through
 * Secrets Manager/KMS behind an alternative SecretsProvider implementation,
 * with zero change to this module or to mfaService.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { SecretsProvider } from "../../../../packages/security/src/SecretsProvider.ts";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce, the standard/recommended size for GCM
const KEY_LENGTH = 32; // 256-bit key
export const MFA_ENCRYPTION_KEY_ENV_VAR = "SVE_IDENTITY_MFA_ENCRYPTION_KEY";
/** Identifies which key encrypted a given row, for future key rotation — not implemented in this foundation (see docs). */
export const CURRENT_MFA_KEY_ID = "v1";

export interface EncryptedTotpSecret {
  ciphertext: string; // base64
  iv: string; // base64, 12 bytes
  authTag: string; // base64, 16 bytes
  keyId: string;
}

export function encryptTotpSecret(plainBase32Secret: string, key: Buffer, keyId: string = CURRENT_MFA_KEY_ID): EncryptedTotpSecret {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainBase32Secret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), authTag: authTag.toString("base64"), keyId };
}

/**
 * Decrypts a stored secret. Throws if the key is wrong or the ciphertext/
 * auth tag has been tampered with — GCM's tag verification makes this
 * rejection automatic, not something this function has to implement itself.
 */
export function decryptTotpSecret(encrypted: EncryptedTotpSecret, key: Buffer): string {
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(encrypted.iv, "base64"));
  decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(encrypted.ciphertext, "base64")), decipher.final()]);
  return plaintext.toString("utf8");
}

/**
 * Resolves and validates the encryption key once, from a SecretsProvider
 * (never read from process.env directly outside src/config/
 * envSecretsProvider.ts). The key is provided base64-encoded, 32 raw bytes.
 */
export async function loadMfaEncryptionKey(secrets: SecretsProvider): Promise<Buffer> {
  const raw = await secrets.requireSecret(MFA_ENCRYPTION_KEY_ENV_VAR);
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `${MFA_ENCRYPTION_KEY_ENV_VAR} must decode to exactly ${KEY_LENGTH} bytes (got ${key.length}). Generate one with: openssl rand -base64 32`,
    );
  }
  return key;
}
