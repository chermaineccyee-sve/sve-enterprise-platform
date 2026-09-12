/**
 * Secrets provider contract. Contract only — no implementation.
 *
 * apps/svegip's functions read secrets via the Netlify-specific
 * `Netlify.env.get(...)` global directly today (SVEGIP_SESSION_SECRET,
 * SVEGIP_BOOTSTRAP_SECRET) — unchanged by this PR. This contract is what a
 * portable successor would implement, backed by plain environment variables
 * on a private server or AWS Secrets Manager in the cloud, without callers
 * needing to know which.
 */
export interface SecretsProvider {
  getSecret(name: string): Promise<string | undefined>;
  requireSecret(name: string): Promise<string>; // throws if missing/empty
}
