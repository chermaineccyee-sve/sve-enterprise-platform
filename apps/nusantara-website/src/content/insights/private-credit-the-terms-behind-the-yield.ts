import type { Insight } from "./types";

export const privateCreditTerms: Insight = {
  slug: "private-credit-the-terms-behind-the-yield",
  title: "Private credit: the terms behind the yield",
  subtitle: "Headline yield is the least informative number in a private credit proposal. Structure, covenants and liquidity tell the rest of the story.",
  category: "Private Markets",
  date: "2026-09-10",
  author: "Nusantara Research",
  summary:
    "Private credit has become a significant source of income opportunity. Assessing it well means looking past the coupon to the structure that determines how capital behaves under stress.",
  executiveSummary: [
    "Private credit can offer income characteristics that differ from public fixed income. Those characteristics are created — and constrained — by the terms of each loan and each vehicle.",
    "We assess private credit through six lenses: seniority, covenants, collateral, concentration, liquidity terms and valuation policy.",
    "The same headline yield can represent very different risks. The structure, not the number, is the investment.",
  ],
  keyTakeaways: [
    "Seniority and collateral determine recovery; the coupon does not.",
    "Covenant quality is an early-warning system — weak covenants delay the warning.",
    "Vehicle liquidity terms must be consistent with the liquidity of the underlying loans.",
  ],
  tags: ["Private credit", "Income", "Due diligence"],
  hero: { motif: "bars" },
  status: "sample",
  sources: [{ label: "Nusantara Research", detail: "Assessment framework developed for this note." }],
  body: [
    { type: "heading", id: "why-terms", text: "Why the terms matter more than the rate" },
    {
      type: "paragraph",
      text: "Two loans with the same yield can behave very differently when a borrower’s circumstances change. One may be senior, secured and protected by maintenance covenants that bring lenders to the table early. The other may be subordinated, lightly documented and reliant on a single refinancing event. The yield describes the reward; the terms describe the risk.",
    },
    {
      type: "table",
      caption: "Six lenses for assessing private credit",
      columns: ["Lens", "Question we ask", "Why it matters"],
      rows: [
        ["Seniority", "Where does the loan rank in the capital structure?", "Determines priority in recovery"],
        ["Covenants", "Are there maintenance tests, and how tight are they?", "Provides early warning and negotiating leverage"],
        ["Collateral", "What secures the loan, and how is it valued?", "Shapes loss severity in default"],
        ["Concentration", "How diversified are borrowers and sectors?", "Limits exposure to single events"],
        ["Liquidity terms", "How and when can capital be returned?", "Must match underlying asset liquidity"],
        ["Valuation policy", "Who values the loans, how often and on what basis?", "Affects reported returns and fairness between investors"],
      ],
      layer: "data",
    },
    {
      type: "layer",
      layer: "interpretation",
      title: "Our reading",
      body: [
        "In periods of strong demand for income, competition among lenders can loosen terms. That is precisely when discipline on structure is most valuable — and most easily abandoned.",
      ],
    },
    {
      type: "layer",
      layer: "implication",
      title: "For allocation",
      body: [
        "We would rather accept a lower headline yield with stronger structural protection than reach for yield through weaker terms.",
      ],
    },
    { type: "pullquote", text: "The structure, not the number, is the investment." },
    {
      type: "callout",
      title: "Risk",
      text: "Private credit involves credit, liquidity, valuation and concentration risks, and may result in the loss of capital.",
    },
  ],
  related: ["alternatives-require-more-discipline", "from-access-to-governed-allocation", "q4-2026-market-outlook"],
  relatedInstruments: ["us10y"],
};
