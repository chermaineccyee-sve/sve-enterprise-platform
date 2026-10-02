import type { Insight } from "./types";

export const resilienceLens: Insight = {
  slug: "the-resilience-lens",
  title: "The resilience lens",
  subtitle: "Fragility, anxiety, non-linear change and information overload — four conditions that shape how we balance opportunity with resilience.",
  category: "Investment Perspectives",
  date: "2026-08-27",
  author: "Nusantara Research",
  summary:
    "Investors today are better informed than ever and face more noise than ever. We set out four market conditions and the disciplined response each calls for.",
  executiveSummary: [
    "The investment environment is shaped by volatility, uncertainty, complexity and an unprecedented volume of information.",
    "We find it useful to name four conditions — fragility, investor anxiety, non-linear change and information overload — and to define a disciplined response to each.",
    "Resilience sits between risk and return. It is created when opportunity is matched with liquidity design, valuation discipline, risk communication and governance oversight.",
  ],
  keyTakeaways: [
    "Resilience is designed in advance; it cannot be added during stress.",
    "Clear explanation is becoming as important as the investment idea itself.",
    "Modular frameworks adapt to change without abandoning discipline.",
  ],
  tags: ["Risk", "Resilience", "Portfolio construction"],
  hero: { motif: "rings" },
  status: "sample",
  sources: [{ label: "Nusantara Research", detail: "Framework and interpretation developed for this note." }],
  body: [
    { type: "heading", id: "risk-resilience-return", text: "Between risk and return" },
    {
      type: "paragraph",
      text: "Investment discussion is often framed as a trade-off between risk and return. We add a third term. Resilience is the capacity of a portfolio — and of the process behind it — to absorb shocks without forcing poor decisions. It does not remove risk. It determines whether risk, when it materialises, can be managed.",
    },
    {
      type: "table",
      caption: "Four market conditions and a disciplined response",
      columns: ["Condition", "What investors experience", "Disciplined response"],
      rows: [
        ["Fragility", "Structures may fail under weak governance or liquidity stress", "Strong governance and oversight of service arrangements"],
        ["Investor anxiety", "Interest in opportunity, alongside concern about volatility and valuation", "Clear risk disclosure and disciplined communication"],
        ["Non-linear change", "Wealth, regulation, technology and markets shifting together", "Modular frameworks and adaptable documentation"],
        ["Information overload", "Too many claims, narratives and products", "Clear explanation, reporting and investor education"],
      ],
      layer: "interpretation",
    },
    {
      type: "layer",
      layer: "implication",
      title: "For allocation",
      body: [
        "Platforms that simplify complexity while preserving discipline are more likely to earn investor trust. The ability to explain structure, risk and process clearly is now part of the investment case.",
      ],
    },
    {
      type: "pullquote",
      text: "Confidence is created when opportunity is matched with risk communication, liquidity design, valuation methodology and governance oversight.",
    },
    { type: "heading", id: "building-blocks", text: "The building blocks of resilience" },
    {
      type: "list",
      items: [
        "Liquidity alignment — commitments matched to the ability to meet them",
        "Valuation discipline — methodology understood and applied consistently",
        "Risk assessment — downside defined before upside is pursued",
        "Suitability — the right opportunity for the right investor",
        "Monitoring — assumptions reviewed on a defined cycle",
        "Governance oversight — independent challenge built into the process",
      ],
    },
    {
      type: "callout",
      title: "A note on risk",
      text: "No framework eliminates investment risk. Resilience describes how risk is understood and managed, not whether losses can occur.",
    },
  ],
  related: ["from-access-to-governed-allocation", "alternatives-require-more-discipline", "q4-2026-market-outlook"],
};
