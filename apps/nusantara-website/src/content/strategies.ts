import type { DataProvenance } from "@/lib/market/types";

/**
 * Capability architecture — capabilities are kept separate from products.
 *
 * Two independent fields:
 *
 *  status — governance lifecycle; decides whether a capability may be shown
 *           at all in an environment (src/lib/config.ts):
 *             internal → review → public-capability → active-product → archived
 *           (INTERNAL, REVIEW, PUBLIC_CAPABILITY, ACTIVE_PRODUCT, ARCHIVED)
 *
 *  stage  — how it is described publicly (Capability, Future development …).
 *
 * A capability never becomes an offered product automatically. `product` is
 * the future product extension; it stays null until management approves a
 * product, and is displayed only when status is "active-product" (enforced by
 * capabilityProblems()). Do not populate product fields with invented figures.
 */
export const CAPABILITY_STATUSES = ["internal", "review", "public-capability", "active-product", "archived"] as const;
export type CapabilityStatus = (typeof CAPABILITY_STATUSES)[number];

export type StrategyStage = "capability" | "under-review" | "strategy" | "active" | "future-development";
/** @deprecated use StrategyStage */
export type StrategyStatus = StrategyStage;

export const STATUS_INFO: Record<StrategyStage, { label: string; description: string }> = {
  capability: { label: "Capability", description: "An area in which Nusantara can apply its investment process. Not an offered product." },
  "under-review": { label: "Under review", description: "Being assessed through the investment and governance process." },
  strategy: { label: "Strategy", description: "A defined strategy approved internally, not yet available to investors." },
  active: { label: "Active", description: "Available to eligible investors through formal offering documents." },
  "future-development": { label: "Future development", description: "An area of future review only. No current activity." },
};

/** Future product extension. Every field requires management and legal approval. */
export type ProductDetails = {
  objective: string | null;
  strategy: string | null;
  benchmark: string | null;
  /** ISO 4217 base currency. */
  currency: string | null;
  minimumInvestment: string | null;
  liquidity: string | null;
  riskInformation: string | null;
  documents: { title: string; href: string; kind: "offering" | "factsheet" | "risk-disclosure" | "report" | "other" }[];
  /** NAV / performance comes from an approved data source, never from content. */
  navPerformance: { provenance: DataProvenance; endpoint: string } | null;
  legalDisclosures: string | null;
  approvedBy: string;
  approvedAt: string;
};

export type Strategy = {
  slug: string;
  name: string;
  /** Governance lifecycle. */
  status: CapabilityStatus;
  /** Public description of the capability's stage. */
  stage: StrategyStage;
  summary: string;
  overview: string;
  approach: string;
  opportunitySet: string[];
  /** The risks a capability relates to. */
  riskConsiderations: string[];
  /** General time horizon of the capability; null until supplied. */
  timeHorizon: string | null;
  characteristics: string[];
  /** One-line role in a portfolio (general, capability-level). */
  role: string;
  /**
   * Indicative, general characteristics of the ASSET CLASS (0 lower · 1 moderate · 2 higher).
   * Not product terms. Null for future-development areas.
   */
  profile: { liquidity: 0 | 1 | 2; income: 0 | 1 | 2; complexity: 0 | 1 | 2; valuationFrequency: 0 | 1 | 2 } | null;
  /** Instrument ids. */
  markets: string[];
  /** Structural indicator ids. */
  indicators: string[];
  /** Insight slugs, most relevant first. */
  insights: string[];
  /** Product extension — null unless management approves a product. */
  product: ProductDetails | null;
};

/** Integrity rules; violations fail the build rather than reach the public. */
export function capabilityProblems(s: Strategy): string[] {
  const out: string[] = [];
  if (s.status === "active-product" && !s.product) out.push(`${s.slug}: active-product without approved product details`);
  if (s.status === "active-product" && s.stage !== "active") out.push(`${s.slug}: active-product must have stage "active"`);
  if (s.stage === "active" && s.status !== "active-product") out.push(`${s.slug}: stage "active" requires status "active-product"`);
  return out;
}

export const PROFILE_AXES = [
  { key: "liquidity", label: "Liquidity", low: "Lower", high: "Higher" },
  { key: "income", label: "Income orientation", low: "Lower", high: "Higher" },
  { key: "complexity", label: "Complexity", low: "Lower", high: "Higher" },
  { key: "valuationFrequency", label: "Valuation frequency", low: "Periodic", high: "Frequent" },
] as const;

export const STRATEGIES: Strategy[] = [
  {
    slug: "income-strategies",
    name: "Income Strategies",
    status: "review",
    stage: "capability",
    summary: "Allocation to opportunities whose primary purpose is the generation of income.",
    overview:
      "Income-oriented allocation seeks to generate regular distributions from a range of underlying sources. The quality and durability of income, rather than its headline level, is the central consideration.",
    approach:
      "Opportunities are assessed on the sources and sustainability of income, the risks to capital that accompany it, and how distributions behave across different market conditions.",
    opportunitySet: ["Fixed income and credit", "Income-generating real assets", "Selected private credit", "Dividend-oriented equity exposure"],
    riskConsiderations: ["Credit and default risk", "Interest-rate sensitivity", "Liquidity mismatch", "Risk that income is maintained at the expense of capital"],
    timeHorizon: null,
    characteristics: ["Income-oriented", "Diversified sources of return", "Emphasis on durability over level"],
    role: "Regular distributions — durability of income over its level.",
    profile: { liquidity: 1, income: 2, complexity: 1, valuationFrequency: 1 },
    markets: ["us10y", "mgs10y"],
    indicators: ["macro-policy"],
    insights: ["rates-currencies-and-the-regional-allocator"],
    product: null,
  },
  {
    slug: "private-credit",
    name: "Private Credit",
    status: "review",
    stage: "capability",
    summary: "Lending outside public bond markets, assessed on structure as much as yield.",
    overview:
      "Private credit provides financing to borrowers outside public markets. Returns are shaped by the terms of each loan — seniority, covenants, collateral — and by the liquidity terms of the vehicle through which it is accessed.",
    approach:
      "We assess private credit through seniority, covenant quality, collateral, concentration, liquidity terms and valuation policy, and would rather accept a lower headline yield than weaker structural protection.",
    opportunitySet: ["Senior secured lending", "Asset-backed financing", "Specialty and niche lending"],
    riskConsiderations: ["Borrower default", "Limited liquidity", "Valuation is periodic and model-based", "Concentration risk"],
    timeHorizon: null,
    characteristics: ["Income-oriented", "Lower liquidity than listed markets", "Structure-dependent outcomes"],
    role: "Income from lending, with outcomes shaped by structure.",
    profile: { liquidity: 0, income: 2, complexity: 2, valuationFrequency: 0 },
    markets: ["us10y", "us2y"],
    indicators: ["pm-credit"],
    insights: ["private-credit-the-terms-behind-the-yield"],
    product: null,
  },
  {
    slug: "real-assets",
    name: "Real Assets",
    status: "review",
    stage: "capability",
    summary: "Exposure to physical assets such as property and infrastructure.",
    overview:
      "Real assets can provide income and a degree of linkage to inflation. Their outcomes depend on asset quality, leverage, operating performance and the valuation approach applied.",
    approach:
      "Opportunities are reviewed on asset quality, income durability, leverage, operating risk and valuation methodology and frequency.",
    opportunitySet: ["Real estate", "Infrastructure", "Other income-producing physical assets"],
    riskConsiderations: ["Illiquidity", "Leverage", "Valuation lag", "Operational and tenant risk"],
    timeHorizon: null,
    characteristics: ["Long-dated", "Potential income and inflation linkage", "Appraisal-based valuation"],
    role: "Income and a degree of inflation linkage from physical assets.",
    profile: { liquidity: 0, income: 1, complexity: 1, valuationFrequency: 0 },
    markets: ["us10y"],
    indicators: ["alt-real-assets"],
    insights: ["alternatives-require-more-discipline"],
    product: null,
  },
  {
    slug: "precious-metals",
    name: "Precious Metals",
    status: "review",
    stage: "capability",
    summary: "Precious metals considered principally as a portfolio-resilience component.",
    overview:
      "Precious metals have historically been held for reserve and diversification characteristics. We consider them principally through a portfolio-resilience lens.",
    approach:
      "Assessment focuses on the form of exposure, custody arrangements, title and redemption rights, and the role the exposure plays within a broader portfolio.",
    opportunitySet: ["Physically backed exposure", "Listed instruments referencing precious metals"],
    riskConsiderations: ["Price volatility", "Custody and title risk", "No income generation", "Currency effects"],
    timeHorizon: null,
    characteristics: ["Resilience-oriented", "Custody-sensitive", "Non-income-producing"],
    role: "A resilience component, held for behaviour in stress.",
    profile: { liquidity: 2, income: 0, complexity: 0, valuationFrequency: 2 },
    markets: ["gold", "silver"],
    indicators: ["alt-precious"],
    insights: ["precious-metals-and-portfolio-resilience"],
    product: null,
  },
  {
    slug: "alternative-investments",
    name: "Alternative Investments",
    status: "review",
    stage: "capability",
    summary: "Strategies with return drivers that differ from traditional equity and bond markets.",
    overview:
      "Alternative investments span a wide range of strategies. Their potential diversification benefits come with demands for liquidity alignment, valuation discipline and rigorous due diligence.",
    approach:
      "Each alternative exposure is assessed on its own merits: strategy transparency, liquidity terms, leverage, valuation, fees, and the operational controls of the manager.",
    opportunitySet: ["Hedge fund strategies", "Private equity", "Selected structured opportunities"],
    riskConsiderations: ["Illiquidity and redemption restrictions", "Complexity and leverage", "Valuation uncertainty", "Manager and operational risk"],
    timeHorizon: null,
    characteristics: ["Differentiated return drivers", "Due-diligence intensive", "Varied liquidity profiles"],
    role: "Return drivers that differ from traditional markets.",
    profile: { liquidity: 0, income: 1, complexity: 2, valuationFrequency: 0 },
    markets: [],
    indicators: ["am-alt-share", "inst-alts"],
    insights: ["alternatives-require-more-discipline"],
    product: null,
  },
  {
    slug: "regional-opportunities",
    name: "Regional Opportunities",
    status: "review",
    stage: "capability",
    summary: "Selected opportunities across the region, assessed with attention to concentration and execution.",
    overview:
      "Regional allocation can provide exposure to growth, demographic and structural themes. It also brings considerations of currency, concentration and execution that must be addressed explicitly.",
    approach:
      "Opportunities are assessed against regional market conditions, currency exposure, liquidity, governance standards and concentration within the wider portfolio.",
    opportunitySet: ["Listed regional markets", "Private regional opportunities", "Thematic regional exposures"],
    riskConsiderations: ["Currency risk", "Concentration risk", "Market liquidity", "Execution and governance standards"],
    timeHorizon: null,
    characteristics: ["Growth-oriented themes", "Currency-sensitive", "Selective"],
    role: "Exposure to regional growth and structural themes.",
    profile: { liquidity: 2, income: 1, complexity: 1, valuationFrequency: 2 },
    markets: ["klci", "sti", "jci"],
    indicators: ["cf-portfolio"],
    insights: ["q4-2026-market-outlook"],
    product: null,
  },
  {
    slug: "shariah-capable",
    name: "Shariah-Capable Strategies",
    status: "review",
    stage: "capability",
    summary: "A parallel track for investors seeking Shariah-compliant allocation, under shared governance principles.",
    overview:
      "Shariah-capable allocation can serve investors whose principles require Shariah-compliant exposure. It shares the same standards of governance, suitability, disclosure and reporting as conventional allocation.",
    approach:
      "Shariah-capable allocation would be supported by appropriate screening, Shariah adviser oversight and documentation before being presented as a formal track.",
    opportunitySet: ["Shariah-screened equity", "Sukuk", "Shariah-compliant real assets and financing"],
    riskConsiderations: ["Narrower opportunity set", "Screening and compliance risk", "Purification requirements", "Standard investment risks apply"],
    timeHorizon: null,
    characteristics: ["Principle-aligned", "Shared governance standards", "Adviser oversight"],
    role: "Principle-aligned allocation under shared governance.",
    profile: { liquidity: 1, income: 1, complexity: 1, valuationFrequency: 1 },
    markets: [],
    indicators: [],
    insights: ["shariah-capable-allocation-shared-principles"],
    product: null,
  },
];
