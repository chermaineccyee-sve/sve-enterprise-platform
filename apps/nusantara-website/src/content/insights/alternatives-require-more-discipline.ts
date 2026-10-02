import { researchSample } from "./sample";
import type { Insight } from "./types";

export const alternativesRequireDiscipline: Insight = {
  slug: "alternatives-require-more-discipline",
  title: "Alternatives require more discipline, not less",
  subtitle: "As alternative assets move closer to the core of portfolios, liquidity, valuation and due diligence become the decisive questions.",
  category: "Alternative Investments",
  date: "2026-09-18",
  author: "Nusantara Research",
  summary:
    "Alternatives can broaden diversification and income. They also bring longer holding periods, less frequent pricing and more complex due diligence — which is why the framework around them matters as much as the asset.",
  executiveSummary: [
    "Alternative assets — private credit, real assets, hedge fund strategies, precious metals and selected structured opportunities — are no longer a peripheral allocation for many investors.",
    "Their appeal is real: different return drivers, potential income and diversification. So are their demands: lower liquidity, appraisal-based valuation and more intensive due diligence.",
    "The opportunity is strongest where alternatives are presented through a governed framework in which risk, liquidity, valuation, suitability and reporting are addressed explicitly.",
  ],
  keyTakeaways: [
    "Liquidity terms should match the investor’s horizon and obligations, not the other way round.",
    "Valuation methodology deserves the same scrutiny as the return assumption.",
    "Each alternative exposure should be assessed on its own risk, custody and governance requirements.",
  ],
  tags: ["Alternatives", "Liquidity", "Valuation", "Due diligence"],
  hero: { motif: "grid" },
  ...researchSample("2026-09-18"),
  assetClasses: ["Alternatives", "Private markets"],
  sources: [{ label: "Nusantara Research", detail: "Framework and interpretation developed for this note." }],
  body: [
    { type: "heading", id: "context", text: "From periphery to core" },
    {
      type: "paragraph",
      text: "Alternatives were once a small satellite allocation reserved for the largest institutions. Today they are discussed as part of mainstream portfolio construction. That shift raises the standard of care required. An exposure that represents a small fraction of a portfolio can tolerate ambiguity; one that represents a meaningful share cannot.",
    },
    {
      type: "layer",
      layer: "data",
      title: "What changes with alternatives",
      body: [
        "Holding periods are typically longer. Pricing is often periodic and appraisal-based rather than continuous. Exit may depend on transaction markets or on redemption terms with notice periods and gates.",
      ],
    },
    {
      type: "layer",
      layer: "interpretation",
      title: "What it means",
      body: [
        "A smoother reported return can reflect valuation methodology rather than lower risk. Investors need to understand how a value is arrived at, not only what it is.",
      ],
    },
    {
      type: "layer",
      layer: "implication",
      title: "For allocation",
      body: [
        "Allocations should be sized against a liquidity budget, with an explicit view of what the investor could need to realise, and when.",
      ],
    },
    { type: "heading", id: "considerations", text: "Considerations by category" },
    {
      type: "table",
      caption: "Selected alternative categories and their key considerations",
      columns: ["Category", "Potential role", "Key consideration"],
      rows: [
        ["Private credit", "Income and diversification", "Underwriting, seniority, covenants and liquidity terms"],
        ["Real assets", "Income and inflation linkage", "Asset quality, leverage and valuation frequency"],
        ["Precious metals", "Reserve and resilience characteristics", "Custody, title and price volatility"],
        ["Hedge fund strategies", "Differentiated return drivers", "Strategy transparency, leverage and fees"],
        ["Shariah-capable strategies", "Alignment with investor principles", "Screening, adviser oversight and documentation"],
        ["Tokenised real-world assets", "Future relevance only", "Legal title, enforceability, custody and regulation"],
      ],
      layer: "data",
    },
    {
      type: "pullquote",
      text: "The question is not whether alternatives belong in a portfolio. It is whether they arrive with a framework strong enough to carry them.",
    },
    { type: "heading", id: "framework", text: "A governed framework for alternatives" },
    {
      type: "list",
      items: [
        "Liquidity alignment — matching redemption terms to the investor’s horizon and obligations",
        "Valuation discipline — understanding methodology, frequency and independence of valuation",
        "Due diligence — on the manager, the structure, the counterparties and the operational controls",
        "Suitability — confirming the exposure is appropriate for the investor in question",
        "Reporting — committing in advance to what will be reported, and how often",
      ],
    },
    {
      type: "callout",
      title: "Risk",
      text: "Alternative investments may be illiquid, difficult to value and subject to the loss of some or all capital invested. They are not suitable for every investor.",
    },
  ],
  related: ["private-credit-the-terms-behind-the-yield", "from-access-to-governed-allocation"],
  markets: ["gold"],
};
