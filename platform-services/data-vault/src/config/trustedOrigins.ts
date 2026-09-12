/**
 * Configurable allowlist of origins trusted to make state-changing Data
 * Vault requests using the transitional SVEGIP session-cookie bridge (see
 * src/api/middleware/dataVaultActor.ts and docs/architecture/
 * data-vault-foundation.md "CSRF/origin protection for the SVEGIP cookie
 * bridge"). Deliberately kept as plain configuration, not a secret and
 * not hard-coded domain logic — production/staging hostnames must never
 * appear as literals anywhere in src/, only ever supplied via this
 * environment variable per deployment.
 *
 * Not read through SecretsProvider: these values are not sensitive (an
 * allowed origin is public information, visible in every browser request
 * anyway) — stretching the secrets abstraction over plain configuration
 * would add indirection with no security benefit.
 */
export const TRUSTED_ORIGINS_ENV_VAR = "SVE_DATA_VAULT_TRUSTED_ORIGINS";

export function loadTrustedOrigins(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const raw = env[TRUSTED_ORIGINS_ENV_VAR] ?? "";
  const origins = raw
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  return new Set(origins);
}
