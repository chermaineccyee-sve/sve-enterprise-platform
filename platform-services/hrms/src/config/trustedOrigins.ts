/**
 * Configurable allowlist of origins trusted to make state-changing HRMS
 * requests using the transitional SVEGIP session-cookie bridge (see
 * src/api/middleware/actor.ts) — mirrors platform-services/organisation's
 * own config/trustedOrigins.ts exactly, duplicated rather than imported
 * since these sibling packages share no workspace/package boundary.
 */
export const TRUSTED_ORIGINS_ENV_VAR = "SVE_HRMS_TRUSTED_ORIGINS";

export function loadTrustedOrigins(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const raw = env[TRUSTED_ORIGINS_ENV_VAR] ?? "";
  const origins = raw
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  return new Set(origins);
}
