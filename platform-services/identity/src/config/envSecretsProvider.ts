/**
 * Concrete, portable SecretsProvider (packages/security/src/SecretsProvider.ts)
 * for local development and SVE's private/internal server: reads from
 * process.env. A future AWS deployment implements the same interface backed
 * by Secrets Manager/KMS instead — nothing that depends on SecretsProvider
 * (see src/crypto/mfaSecretCipher.ts) needs to change when that happens.
 */
import type { SecretsProvider } from "../../../../packages/security/src/SecretsProvider.ts";

export function createEnvSecretsProvider(): SecretsProvider {
  return {
    async getSecret(name: string): Promise<string | undefined> {
      return process.env[name];
    },
    async requireSecret(name: string): Promise<string> {
      const value = process.env[name];
      if (!value) throw new Error(`Missing required secret: ${name}`);
      return value;
    },
  };
}
