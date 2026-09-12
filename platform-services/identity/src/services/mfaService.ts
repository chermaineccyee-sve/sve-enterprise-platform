/**
 * TOTP MFA foundation. See docs/architecture/identity-foundation.md "MFA"
 * for the architectural boundary that lets WebAuthn/passkeys/hardware keys
 * be added later as additional method_type values without redesigning this
 * service's shape (enrol -> verify-before-activate -> challenge -> disable).
 */
import { randomUUID } from "node:crypto";
import type { MfaRepository } from "../repositories/types.ts";
import { generateTotpSecret, verifyTotp, buildOtpauthUri } from "../crypto/totp.ts";
import { base32Decode } from "../crypto/base32.ts";
import { generateRecoveryCode, sha256Hex } from "../crypto/token.ts";
import { MfaAlreadyActiveError, MfaVerificationError, RecoveryCodeInvalidError } from "../domain/errors.ts";

const RECOVERY_CODE_COUNT = 10;
const ISSUER = "SVE Enterprise Platform";

export function createMfaService(deps: { mfa: MfaRepository }) {
  return {
    /** Starts enrolment: generates a secret, stores it as 'pending', returns enrolment info. Not active until verified. */
    async beginEnrolment(input: { userId: string; accountEmail: string }) {
      const existing = await deps.mfa.findActiveOrPendingByUser(input.userId);
      if (existing) throw new MfaAlreadyActiveError();
      const { secret, base32 } = generateTotpSecret();
      const method = await deps.mfa.createMethod({ userId: input.userId, secretEncrypted: base32 });
      const otpauthUri = buildOtpauthUri({ secretBase32: base32, accountName: input.accountEmail, issuer: ISSUER });
      // The secret is returned exactly once, at enrolment time, for the QR code — never logged, never re-returned later.
      return { methodId: method.id, secretBase32: base32, otpauthUri };
    },

    /** Verifies the first TOTP code and activates the method. Required before MFA is considered enabled. */
    async completeEnrolment(input: { userId: string; methodId: string; code: string; secretBase32: string }): Promise<void> {
      const secret = base32Decode(input.secretBase32);
      const result = verifyTotp(secret, input.code);
      if (!result.valid) throw new MfaVerificationError();
      await deps.mfa.activateMethod(input.methodId);
    },

    /** Verifies a code against an already-active method during login. */
    async verifyChallenge(input: { secretBase32: string; code: string }): Promise<boolean> {
      const secret = base32Decode(input.secretBase32);
      return verifyTotp(secret, input.code).valid;
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
