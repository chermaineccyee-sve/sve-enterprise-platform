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
};

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
  },
  {
    slug: "tokenised-real-world-assets",
    name: "Tokenised Real-World Assets",
    status: "future-development",
    summary: "An area of future review only, subject to legal, custody and governance requirements.",
    overview:
      "Tokenisation may in time improve access, settlement and operational efficiency for some assets. It does not remove the need for legal clarity, custody control, liquidity and investor protection.",
    objective: null,
    approach: "Framework-first: no exposure would be considered until legal title, enforceability, custody and regulatory questions are satisfactorily answered.",
    opportunitySet: ["Under review — no current opportunity set"],
    riskConsiderations: ["Legal and enforceability risk", "Custody and technology risk", "Liquidity risk", "Regulatory uncertainty"],
    timeHorizon: null,
    characteristics: ["Future review only", "Framework-first"],
    documents: [],
  },
];

export function getStrategy(slug: string) {
  return STRATEGIES.find((s) => s.slug === slug);
}
