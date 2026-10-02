/**
 * Strategy / capability architecture.
 *
 * Every entry is a CAPABILITY unless management confirms otherwise. The
 * status field drives labelling everywhere; fields that require approved
 * information (objective, time horizon, documents) are null and render as
 * management-review placeholders. Do not populate them with invented figures.
 */
export type StrategyStatus = "capability" | "under-review" | "strategy" | "active" | "future-development";

export const STATUS_INFO: Record<StrategyStatus, { label: string; description: string }> = {
  capability: { label: "Capability", description: "An area in which Nusantara can apply its investment process. Not an offered product." },
  "under-review": { label: "Under review", description: "Being assessed through the investment and governance process." },
  strategy: { label: "Strategy", description: "A defined strategy approved internally, not yet available to investors." },
  active: { label: "Active", description: "Available to eligible investors through formal offering documents." },
  "future-development": { label: "Future development", description: "An area of future review only. No current activity." },
};

export type Strategy = {
  slug: string;
  name: string;
  status: StrategyStatus;
  summary: string;
  overview: string;
  /** Approved objective; null until supplied. */
  objective: string | null;
  approach: string;
  opportunitySet: string[];
  riskConsiderations: string[];
  /** Approved time horizon; null until supplied. */
  timeHorizon: string | null;
  characteristics: string[];
  documents: { title: string; href: string }[];
  /** One-line role in a portfolio (general, capability-level). */
  role: string;
  /**
   * Indicative, general characteristics of the ASSET CLASS (0 lower · 1 moderate · 2 higher).
   * Not product terms. Null for future-development areas.
   */
  profile: { liquidity: 0 | 1 | 2; income: 0 | 1 | 2; complexity: 0 | 1 | 2; valuationFrequency: 0 | 1 | 2 } | null;
  relatedInstruments: string[];
  relatedIndicators: string[];
  insight: string;
};

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
    status: "capability",
    summary: "Allocation to opportunities whose primary purpose is the generation of income.",
    overview:
      "Income-oriented allocation seeks to generate regular distributions from a range of underlying sources. The quality and durability of income, rather than its headline level, is the central consideration.",
    objective: null,
    approach:
      "Opportunities are assessed on the sources and sustainability of income, the risks to capital that accompany it, and how distributions behave across different market conditions.",
    opportunitySet: ["Fixed income and credit", "Income-generating real assets", "Selected private credit", "Dividend-oriented equity exposure"],
    riskConsiderations: ["Credit and default risk", "Interest-rate sensitivity", "Liquidity mismatch", "Risk that income is maintained at the expense of capital"],
    timeHorizon: null,
    characteristics: ["Income-oriented", "Diversified sources of return", "Emphasis on durability over level"],
    documents: [],
    role: "Regular distributions — durability of income over its level.",
    profile: { liquidity: 1, income: 2, complexity: 1, valuationFrequency: 1 },
    relatedInstruments: ["us10y", "mgs10y"],
    relatedIndicators: ["macro-policy"],
    insight: "rates-currencies-and-the-regional-allocator",
  },
  {
    slug: "private-credit",
    name: "Private Credit",
    status: "capability",
    summary: "Lending outside public bond markets, assessed on structure as much as yield.",
    overview:
      "Private credit provides financing to borrowers outside public markets. Returns are shaped by the terms of each loan — seniority, covenants, collateral — and by the liquidity terms of the vehicle through which it is accessed.",
    objective: null,
    approach:
      "We assess private credit through seniority, covenant quality, collateral, concentration, liquidity terms and valuation policy, and would rather accept a lower headline yield than weaker structural protection.",
    opportunitySet: ["Senior secured lending", "Asset-backed financing", "Specialty and niche lending"],
    riskConsiderations: ["Borrower default", "Limited liquidity", "Valuation is periodic and model-based", "Concentration risk"],
    timeHorizon: null,
    characteristics: ["Income-oriented", "Lower liquidity than listed markets", "Structure-dependent outcomes"],
    documents: [],
    role: "Income from lending, with outcomes shaped by structure.",
    profile: { liquidity: 0, income: 2, complexity: 2, valuationFrequency: 0 },
    relatedInstruments: ["us10y", "us2y"],
    relatedIndicators: ["pm-credit"],
    insight: "private-credit-the-terms-behind-the-yield",
  },
  {
    slug: "real-assets",
    name: "Real Assets",
    status: "capability",
    summary: "Exposure to physical assets such as property and infrastructure.",
    overview:
      "Real assets can provide income and a degree of linkage to inflation. Their outcomes depend on asset quality, leverage, operating performance and the valuation approach applied.",
    objective: null,
    approach:
      "Opportunities are reviewed on asset quality, income durability, leverage, operating risk and valuation methodology and frequency.",
    opportunitySet: ["Real estate", "Infrastructure", "Other income-producing physical assets"],
    riskConsiderations: ["Illiquidity", "Leverage", "Valuation lag", "Operational and tenant risk"],
    timeHorizon: null,
    characteristics: ["Long-dated", "Potential income and inflation linkage", "Appraisal-based valuation"],
    documents: [],
    role: "Income and a degree of inflation linkage from physical assets.",
    profile: { liquidity: 0, income: 1, complexity: 1, valuationFrequency: 0 },
    relatedInstruments: ["us10y"],
    relatedIndicators: ["alt-real-assets"],
    insight: "alternatives-require-more-discipline",
  },
  {
    slug: "precious-metals",
    name: "Precious Metals",
    status: "capability",
    summary: "Precious metals considered principally as a portfolio-resilience component.",
    overview:
      "Precious metals have historically been held for reserve and diversification characteristics. We consider them principally through a portfolio-resilience lens.",
    objective: null,
    approach:
      "Assessment focuses on the form of exposure, custody arrangements, title and redemption rights, and the role the exposure plays within a broader portfolio.",
    opportunitySet: ["Physically backed exposure", "Listed instruments referencing precious metals"],
    riskConsiderations: ["Price volatility", "Custody and title risk", "No income generation", "Currency effects"],
    timeHorizon: null,
    characteristics: ["Resilience-oriented", "Custody-sensitive", "Non-income-producing"],
    documents: [],
    role: "A resilience component, held for behaviour in stress.",
    profile: { liquidity: 2, income: 0, complexity: 0, valuationFrequency: 2 },
    relatedInstruments: ["gold", "silver"],
    relatedIndicators: ["alt-precious"],
    insight: "precious-metals-and-portfolio-resilience",
  },
  {
    slug: "alternative-investments",
    name: "Alternative Investments",
    status: "capability",
    summary: "Strategies with return drivers that differ from traditional equity and bond markets.",
    overview:
      "Alternative investments span a wide range of strategies. Their potential diversification benefits come with demands for liquidity alignment, valuation discipline and rigorous due diligence.",
    objective: null,
    approach:
      "Each alternative exposure is assessed on its own merits: strategy transparency, liquidity terms, leverage, valuation, fees, and the operational controls of the manager.",
    opportunitySet: ["Hedge fund strategies", "Private equity", "Selected structured opportunities"],
    riskConsiderations: ["Illiquidity and redemption restrictions", "Complexity and leverage", "Valuation uncertainty", "Manager and operational risk"],
    timeHorizon: null,
    characteristics: ["Differentiated return drivers", "Due-diligence intensive", "Varied liquidity profiles"],
    documents: [],
    role: "Return drivers that differ from traditional markets.",
    profile: { liquidity: 0, income: 1, complexity: 2, valuationFrequency: 0 },
    relatedInstruments: [],
    relatedIndicators: ["am-alt-share", "inst-alts"],
    insight: "alternatives-require-more-discipline",
  },
  {
    slug: "regional-opportunities",
    name: "Regional Opportunities",
    status: "capability",
    summary: "Selected opportunities across the region, assessed with attention to concentration and execution.",
    overview:
      "Regional allocation can provide exposure to growth, demographic and structural themes. It also brings considerations of currency, concentration and execution that must be addressed explicitly.",
    objective: null,
    approach:
      "Opportunities are assessed against regional market conditions, currency exposure, liquidity, governance standards and concentration within the wider portfolio.",
    opportunitySet: ["Listed regional markets", "Private regional opportunities", "Thematic regional exposures"],
    riskConsiderations: ["Currency risk", "Concentration risk", "Market liquidity", "Execution and governance standards"],
    timeHorizon: null,
    characteristics: ["Growth-oriented themes", "Currency-sensitive", "Selective"],
    documents: [],
    role: "Exposure to regional growth and structural themes.",
    profile: { liquidity: 2, income: 1, complexity: 1, valuationFrequency: 2 },
    relatedInstruments: ["klci", "sti", "jci"],
    relatedIndicators: ["cf-portfolio"],
    insight: "q4-2026-market-outlook",
  },
  {
    slug: "shariah-capable",
    name: "Shariah-Capable Strategies",
    status: "capability",
    summary: "A parallel track for investors seeking Shariah-compliant allocation, under shared governance principles.",
    overview:
      "Shariah-capable allocation can serve investors whose principles require Shariah-compliant exposure. It shares the same standards of governance, suitability, disclosure and reporting as conventional allocation.",
    objective: null,
    approach:
      "Shariah-capable allocation would be supported by appropriate screening, Shariah adviser oversight and documentation before being presented as a formal track.",
    opportunitySet: ["Shariah-screened equity", "Sukuk", "Shariah-compliant real assets and financing"],
    riskConsiderations: ["Narrower opportunity set", "Screening and compliance risk", "Purification requirements", "Standard investment risks apply"],
    timeHorizon: null,
    characteristics: ["Principle-aligned", "Shared governance standards", "Adviser oversight"],
    documents: [],
    role: "Principle-aligned allocation under shared governance.",
    profile: { liquidity: 1, income: 1, complexity: 1, valuationFrequency: 1 },
    relatedInstruments: [],
    relatedIndicators: [],
    insight: "shariah-capable-allocation-shared-principles",
  },
];

export function getStrategy(slug: string) {
  return STRATEGIES.find((s) => s.slug === slug);
}
