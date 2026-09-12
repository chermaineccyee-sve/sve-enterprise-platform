/**
 * TOTP MFA foundation. See docs/architecture/identity-foundation.md "MFA"
 * for the architectural boundary that lets WebAuthn/passkeys/hardware keys
 * be added later as additional method_type values without redesigning this
 * service's shape (enrol -> verify-before-activate -> challenge -> disable).
 *
 * Stored TOTP secrets are AES-256-GCM ciphertext (src/crypto/
 * mfaSecretCipher.ts) — decryption happens only inside this service.
 * Callers (HTTP routes, authService) never see plaintext secret material
 * except in beginEnrolment's one-time return value, needed for the QR code.
 */
import { randomUUID } from "node:crypto";
import type { MfaRepository } from "../repositories/types.ts";
import { generateTotpSecret, verifyTotp, buildOtpauthUri } from "../crypto/totp.ts";
import { base32Decode } from "../crypto/base32.ts";
import { generateRecoveryCode, sha256Hex } from "../crypto/token.ts";
import { encryptTotpSecret, decryptTotpSecret } from "../crypto/mfaSecretCipher.ts";
import { MfaAlreadyActiveError, MfaVerificationError, RecoveryCodeInvalidError } from "../domain/errors.ts";

const RECOVERY_CODE_COUNT = 10;
const ISSUER = "SVE Enterprise Platform";

export function createMfaService(deps: { mfa: MfaRepository; encryptionKey: Buffer }) {
  return {
    /** Starts enrolment: generates a secret, stores it encrypted as 'pending', returns enrolment info. Not active until verified. */
    async beginEnrolment(input: { userId: string; accountEmail: string }) {
      const existing = await deps.mfa.findActiveOrPendingByUser(input.userId);
      if (existing) throw new MfaAlreadyActiveError();
      const { base32 } = generateTotpSecret();
      const encrypted = encryptTotpSecret(base32, deps.encryptionKey);
      const method = await deps.mfa.createMethod({ userId: input.userId, secret: encrypted });
      const otpauthUri = buildOtpauthUri({ secretBase32: base32, accountName: input.accountEmail, issuer: ISSUER });
      // The plaintext secret is returned exactly once, here, for the QR code
      // — never logged, never persisted in plaintext, never re-returned by
      // any other method or endpoint.
      return { methodId: method.id, secretBase32: base32, otpauthUri };
    },

    /**
     * Verifies the first TOTP code and activates the method. Required
     * before MFA is considered enabled. Decrypts the stored secret
     * internally — the caller supplies only methodId/code, never the
     * plaintext secret, so there is no client-supplied-secret trust issue.
     */
    async completeEnrolment(input: { userId: string; methodId: string; code: string }): Promise<void> {
      const method = await deps.mfa.findActiveOrPendingByUser(input.userId);
      if (!method || method.id !== input.methodId) throw new MfaVerificationError();
      const plainSecret = decryptTotpSecret(method.secret, deps.encryptionKey);
      const result = verifyTotp(base32Decode(plainSecret), input.code);
      if (!result.valid) throw new MfaVerificationError();
      await deps.mfa.activateMethod(input.methodId);
    },

    /** Verifies a code against the caller's already-active method during login. Decrypts internally. */
    async verifyChallenge(input: { userId: string; code: string }): Promise<boolean> {
      const method = await deps.mfa.findActiveOrPendingByUser(input.userId);
      if (!method || method.status !== "active") return false;
      const plainSecret = decryptTotpSecret(method.secret, deps.encryptionKey);
      return verifyTotp(base32Decode(plainSecret), input.code).valid;
    },

    async disable(input: { methodId: string; disabledBy: string }): Promise<void> {
      await deps.mfa.disableMethod(input.methodId, input.disabledBy);
    },

    async getActiveOrPendingMethod(userId: string) {
      return deps.mfa.findActiveOrPendingByUser(userId);
    },

    /** Generates a fresh batch of recovery codes, returned exactly once. Replaces (invalidates) any previous batch. */
    async generateRecoveryCodes(userId: string): Promise<string[]> {
      const generationId = randomUUID();
      const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => generateRecoveryCode());
      const codeHashes = codes.map((c) => sha256Hex(c));
      await deps.mfa.replaceRecoveryCodes({ userId, generationId, codeHashes });
      return codes;
    },

    /** Consumes a recovery code — single use, throws if invalid or already used. */
    async consumeRecoveryCode(input: { userId: string; code: string }): Promise<void> {
      const hash = sha256Hex(input.code.trim().toUpperCase());
      const found = await deps.mfa.findUnusedRecoveryCodeByHash(input.userId, hash);
      if (!found) throw new RecoveryCodeInvalidError();
      await deps.mfa.markRecoveryCodeUsed(found.id);
    },
  };
}

export type MfaService = ReturnType<typeof createMfaService>;
