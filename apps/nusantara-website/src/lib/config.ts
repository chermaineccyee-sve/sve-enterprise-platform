/**
 * Environment configuration — the single switch between
 *
 *   prototype  → illustrative data, prototype banner, no indexing, sample content shown (labelled)
 *   staging    → test integrations, restricted indexing, approved content previewed
 *   production → approved data and content only, production disclosures, indexing by management decision
 *
 * Set NUSANTARA_ENV at build/deploy time. Moving between environments is a
 * configuration change and a redeploy — never a code change. Every value here
 * is safe to read on the server; nothing secret is exported.
 */

export type SiteEnvironment = "prototype" | "staging" | "production";
export type IndexingPolicy = "none" | "restricted" | "allow";

function readEnvironment(): SiteEnvironment {
  const v = process.env.NUSANTARA_ENV;
  return v === "staging" || v === "production" ? v : "prototype";
}

const environment = readEnvironment();

/**
 * Production indexing is a management decision (see docs/MANAGEMENT_DECISIONS.md).
 * Until SITE_INDEXING=allow is set explicitly, production stays out of indexes.
 */
function readIndexing(): IndexingPolicy {
  if (environment === "prototype") return "none";
  if (environment === "staging") return "restricted";
  return process.env.SITE_INDEXING === "allow" ? "allow" : "none";
}

export const config = {
  environment,
  /** Management-review banner and prototype wording. */
  isPrototype: environment === "prototype",
  indexing: readIndexing(),
  /**
   * Which publication states may be rendered publicly.
   *  - prototype: everything except drafts and archived items, always labelled
   *  - staging:   approved and published (preview before release)
   *  - production: published only
   */
  visibleStatuses: (environment === "production"
    ? ["published"]
    : environment === "staging"
      ? ["approved", "published"]
      : ["review", "approved", "published"]) as readonly string[],
  /** Sample content (written for management review) may only appear in the prototype. */
  allowSampleContent: environment === "prototype",
  /** Market-data provider id; see src/lib/market/service.ts. */
  marketDataProvider: process.env.MARKET_DATA_PROVIDER ?? (environment === "prototype" ? "illustrative" : "unconfigured"),
} as const;

export type SiteConfig = typeof config;
