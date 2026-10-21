/**
 * Environment configuration — the single switch between
 *
 *   review     → MANAGEMENT REVIEW (the default): illustrative market-data
 *                provider, fully populated demonstration, review banner,
 *                no indexing, sample content shown and labelled
 *   staging    → test integrations, restricted indexing, approved content previewed
 *   production → approved provider and published content only, production
 *                disclosures, indexing by management decision
 *
 * Provider failure in any environment → every market surface shows its
 * UNAVAILABLE state (src/lib/market/service.ts).
 *
 * Set NUSANTARA_ENV at build and start time (`npm run build:review` /
 * `start:review` do this). "prototype" and "management-review" are accepted
 * as aliases of "review". Moving between environments is a configuration
 * change and a redeploy — never a code change. Nothing secret is exported.
 */

export type SiteEnvironment = "review" | "staging" | "production";
export type IndexingPolicy = "none" | "restricted" | "allow";

function readEnvironment(): SiteEnvironment {
  const v = process.env.NUSANTARA_ENV;
  return v === "staging" || v === "production" ? v : "review";
}

const environment = readEnvironment();

/**
 * Production indexing is a management decision (see docs/MANAGEMENT_DECISIONS.md).
 * Until SITE_INDEXING=allow is set explicitly, production stays out of indexes.
 */
function readIndexing(): IndexingPolicy {
  if (environment === "review") return "none";
  if (environment === "staging") return "restricted";
  return process.env.SITE_INDEXING === "allow" ? "allow" : "none";
}

export const config = {
  environment,
  /** Management-review banner and prototype wording. */
  isPrototype: environment === "review",
  indexing: readIndexing(),
  /**
   * Which publication states may be rendered publicly.
   *  - review:     everything except drafts and archived items, always labelled
   *  - staging:   approved and published (preview before release)
   *  - production: published only
   */
  visibleStatuses: (environment === "production"
    ? ["published"]
    : environment === "staging"
      ? ["approved", "published"]
      : ["review", "approved", "published"]) as readonly string[],
  /** Sample content (written for management review) may only appear in the review environment. */
  allowSampleContent: environment === "review",
  /**
   * Market-data provider id (src/lib/market/service.ts). Management review
   * uses the illustrative provider; staging and production must name an
   * approved provider, otherwise every market surface shows UNAVAILABLE.
   */
  marketDataProvider: process.env.MARKET_DATA_PROVIDER ?? (environment === "review" ? "illustrative" : "unconfigured"),
} as const;

export type SiteConfig = typeof config;
