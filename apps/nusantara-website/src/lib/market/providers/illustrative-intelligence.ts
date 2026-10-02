/**
 * Level B — strategic market intelligence (illustrative placeholders).
 *
 * Values are expressed as illustrative indices or composites rather than
 * monetary figures, so that no number on the prototype can be mistaken for
 * a published statistic. Readings are phrased conditionally: they describe
 * how Nusantara would interpret a movement, not a claim about the market.
 */
import type { DataProvenance, Direction, IntelligenceCategory, IntelligenceIndicator } from "../types";

const PROVENANCE: DataProvenance = {
  source: "Illustrative placeholder — approved source to be confirmed",
  status: "illustrative",
  asOf: "2026-06-30T00:00:00.000Z",
};

const QUARTERS = ["Q3 23", "Q4 23", "Q1 24", "Q2 24", "Q3 24", "Q4 24", "Q1 25", "Q2 25", "Q3 25", "Q4 25", "Q1 26", "Q2 26"];

/** Deterministic quarterly path that ends exactly at `end`. */
function path(start: number, end: number, wobble: number, seed: number) {
  return QUARTERS.map((label, i) => {
    const frac = i / (QUARTERS.length - 1);
    const noise = i === 0 || i === QUARTERS.length - 1 ? 0 : Math.sin(i * 1.7 + seed) * wobble;
    return { label, v: Math.round((start + (end - start) * frac + noise) * 10) / 10 };
  });
}

type Def = {
  id: string;
  category: IntelligenceCategory;
  title: string;
  measure: string;
  start: number;
  value: number;
  decimals?: number;
  unit?: string;
  direction: Direction;
  wobble?: number;
  reading: string;
};

const DEFS: Def[] = [
  {
    id: "am-assets",
    category: "Asset Management",
    title: "Regional managed assets",
    measure: "Illustrative index (Q3 2023 = 100)",
    start: 100,
    value: 118.6,
    direction: "rising",
    wobble: 1.8,
    reading:
      "A larger pool of managed assets widens the opportunity set, but also intensifies competition. Scale alone does not differentiate; selection and governance do.",
  },
  {
    id: "am-alt-share",
    category: "Asset Management",
    title: "Alternatives as a share of managed assets",
    measure: "Illustrative share",
    start: 19.1,
    value: 22.4,
    unit: "%",
    direction: "rising",
    wobble: 0.3,
    reading:
      "Where alternatives move from the periphery towards the core of portfolios, the bar rises for liquidity alignment, valuation discipline and due diligence.",
  },
  {
    id: "pm-fundraising",
    category: "Private Markets",
    title: "Private capital fundraising activity",
    measure: "Illustrative index (Q3 2023 = 100)",
    start: 100,
    value: 94.2,
    direction: "easing",
    wobble: 2.4,
    reading:
      "Slower fundraising tends to favour allocators with patient capital and places greater weight on manager and transaction selection.",
  },
  {
    id: "pm-undeployed",
    category: "Private Markets",
    title: "Undeployed private capital",
    measure: "Illustrative index (Q3 2023 = 100)",
    start: 100,
    value: 104.8,
    direction: "stable",
    wobble: 1.6,
    reading:
      "Large undeployed commitments can support transaction activity, but may also pressure entry discipline. We watch pricing as closely as volume.",
  },
  {
    id: "pm-credit",
    category: "Private Markets",
    title: "Private credit deployment",
    measure: "Illustrative index (Q3 2023 = 100)",
    start: 100,
    value: 127.3,
    direction: "rising",
    wobble: 2.1,
    reading:
      "Continued deployment can support income opportunities. Terms, covenants and underwriting standards matter more than the headline yield.",
  },
  {
    id: "alt-real-assets",
    category: "Alternative Assets",
    title: "Real assets transaction activity",
    measure: "Illustrative index (Q3 2023 = 100)",
    start: 100,
    value: 103.9,
    direction: "stable",
    wobble: 2.6,
    reading:
      "Stable activity suggests price discovery is functioning. Income durability and the quality of the underlying asset remain the primary tests.",
  },
  {
    id: "alt-precious",
    category: "Alternative Assets",
    title: "Official-sector precious metals demand",
    measure: "Illustrative index (Q3 2023 = 100)",
    start: 100,
    value: 141.7,
    direction: "rising",
    wobble: 3.2,
    reading:
      "If sustained, reserve-diversification demand supports viewing precious metals as a resilience component of a portfolio rather than a tactical position.",
  },
  {
    id: "cf-portfolio",
    category: "Capital Flows",
    title: "Cross-border portfolio flows into Asia",
    measure: "Illustrative rolling four-quarter index",
    start: 100,
    value: 108.4,
    direction: "rising",
    wobble: 3.8,
    reading:
      "Portfolio flows can reverse quickly. We distinguish flow-driven price moves from changes in underlying fundamentals before drawing conclusions.",
  },
  {
    id: "cf-direct",
    category: "Capital Flows",
    title: "Regional direct investment commitments",
    measure: "Illustrative index (Q3 2023 = 100)",
    start: 100,
    value: 115.2,
    direction: "rising",
    wobble: 1.9,
    reading:
      "Direct investment commitments are slower-moving than portfolio flows and can indicate longer-horizon positioning around supply chains and infrastructure.",
  },
  {
    id: "pw-pool",
    category: "Private Wealth",
    title: "Private wealth pool",
    measure: "Illustrative index (Q3 2023 = 100)",
    start: 100,
    value: 112.6,
    direction: "rising",
    wobble: 1.2,
    reading:
      "Larger private wealth pools raise expectations for governance, reporting and clear communication — not only for access to opportunity.",
  },
  {
    id: "pw-advised",
    category: "Private Wealth",
    title: "Demand for advised and discretionary mandates",
    measure: "Illustrative index (Q3 2023 = 100)",
    start: 100,
    value: 109.3,
    direction: "rising",
    wobble: 1.4,
    reading:
      "As information becomes more abundant, demand shifts towards judgement, context and accountability rather than product availability.",
  },
  {
    id: "fo-formation",
    category: "Family Office & Institutional Capital",
    title: "Family office formation activity",
    measure: "Illustrative index (Q3 2023 = 100)",
    start: 100,
    value: 124.5,
    direction: "rising",
    wobble: 2.2,
    reading:
      "Family offices increasingly expect institutional process: documented governance, reporting discipline and succession-aware decision-making.",
  },
  {
    id: "inst-alts",
    category: "Family Office & Institutional Capital",
    title: "Institutional target allocation to alternatives",
    measure: "Illustrative share of portfolio",
    start: 24.8,
    value: 27.1,
    unit: "%",
    direction: "rising",
    wobble: 0.25,
    reading:
      "Higher target allocations are a statement of intent; implementation depends on liquidity budgets, pacing and the availability of suitable opportunities.",
  },
  {
    id: "macro-growth",
    category: "Macro Indicators",
    title: "Regional growth momentum",
    measure: "Illustrative composite (50 = neutral)",
    start: 50.6,
    value: 51.4,
    direction: "stable",
    wobble: 0.7,
    reading:
      "A reading close to neutral suggests uneven momentum. Dispersion across sectors and economies matters more than the aggregate.",
  },
  {
    id: "macro-inflation",
    category: "Macro Indicators",
    title: "Regional inflation pressure",
    measure: "Illustrative composite (50 = neutral)",
    start: 53.2,
    value: 48.9,
    direction: "easing",
    wobble: 0.6,
    reading:
      "Easing inflation pressure can widen the room for policy flexibility, but the path and breadth of disinflation matter as much as the level.",
  },
  {
    id: "macro-policy",
    category: "Macro Indicators",
    title: "Policy rate direction",
    measure: "Illustrative diffusion index (−100 to +100)",
    start: 18,
    value: -22,
    decimals: 0,
    direction: "easing",
    wobble: 6,
    reading:
      "A negative reading would indicate more central banks easing than tightening. Easing phases can support income assets, though the sequencing matters.",
  },
];

export const ILLUSTRATIVE_INDICATORS: IntelligenceIndicator[] = DEFS.map((d, i) => ({
  id: d.id,
  category: d.category,
  title: d.title,
  measure: d.measure,
  value: d.value,
  decimals: d.decimals ?? 1,
  unit: d.unit,
  period: "Q2 2026",
  direction: d.direction,
  series: path(d.start, d.value, d.wobble ?? 1, i),
  reading: d.reading,
  provenance: PROVENANCE,
}));
