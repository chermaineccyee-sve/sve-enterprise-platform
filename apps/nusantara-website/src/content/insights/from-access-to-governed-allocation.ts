import type { Insight } from "./types";

export const fromAccessToGovernedAllocation: Insight = {
  slug: "from-access-to-governed-allocation",
  title: "From access to governed allocation",
  subtitle: "Why the next standard in private wealth is not what investors can reach, but how opportunity is selected, governed and monitored.",
  category: "Governance & Allocation",
  date: "2026-09-29",
  author: "Nusantara Research",
  summary:
    "Access to investment products has broadened considerably. As it does, the point of differentiation moves from availability to selection, portfolio fit, governance and ongoing communication.",
  executiveSummary: [
    "Investors today can reach funds, structured products, private market strategies and alternative assets through more channels than at any point in the past. Access, on its own, has become a weaker differentiator.",
    "The questions serious investors ask have shifted accordingly: why an opportunity was selected, how it fits a portfolio, how its risks are governed, and what information they will receive after committing capital.",
    "We describe this as a move from product access to governed allocation — an approach in which opportunity is accompanied by selection, risk assessment, governance, execution discipline and ongoing monitoring.",
  ],
  keyTakeaways: [
    "Availability is no longer the scarce resource; judgement and discipline are.",
    "Governance is part of the investment proposition, not a back-office function.",
    "Information should be layered by stage of engagement rather than delivered all at once.",
    "Governance improves the quality of decisions; it does not remove investment risk.",
  ],
  tags: ["Governed allocation", "Private wealth", "Governance", "Portfolio construction"],
  hero: { motif: "arcs" },
  featured: true,
  status: "sample",
  sources: [
    { label: "Nusantara Research", detail: "Framework and interpretation developed by Nusantara for this note." },
    {
      label: "Illustrative scenario model",
      detail: "Hypothetical index constructed for demonstration. Not derived from, or calibrated to, any published statistic.",
    },
  ],
  methodology:
    "This note is qualitative. The scenario section uses a hypothetical index (base year = 100) compounded at three constant annual rates to illustrate how outcomes diverge under different assumptions. It is not a forecast and is not calibrated to any market or dataset.",
  body: [
    { type: "heading", id: "executive-market-view", text: "Executive market view" },
    {
      type: "paragraph",
      text: "For much of the past two decades, the central challenge for many investors was reaching the opportunity at all. Minimum sizes were high, information was scarce and the range of available strategies was narrow. That constraint has eased. Platforms, advisers, managers and digital channels now present a broad range of public and private market opportunities to a wider set of investors.",
    },
    {
      type: "paragraph",
      text: "When access becomes common, it stops being a reason to choose. The questions that matter move upstream — to how opportunities are identified and filtered — and downstream, to how capital is governed, reported on and reviewed once it has been committed.",
    },
    {
      type: "layer",
      layer: "data",
      title: "What we observe",
      body: [
        "The range of strategies presented to private and professional investors has widened across private credit, real assets, alternatives and thematic exposures.",
        "Investors increasingly request documentation on governance, valuation, liquidity terms and reporting before engaging on the merits of a strategy.",
      ],
    },
    {
      type: "layer",
      layer: "interpretation",
      title: "What we believe it means",
      body: [
        "The scarce resource is no longer access but judgement: the ability to say no, to explain why an opportunity fits, and to show how it will be overseen.",
      ],
    },
    {
      type: "layer",
      layer: "implication",
      title: "Implication for allocation",
      body: [
        "Allocation frameworks should be evaluated on the discipline of their selection and oversight, not on the breadth of what they can offer.",
      ],
    },

    { type: "heading", id: "investor-behaviour", text: "The shift in investor behaviour" },
    {
      type: "paragraph",
      text: "The change is visible less in what investors buy than in what they ask. A product sheet answers what an opportunity is. Investors now want to understand why it was chosen, how it sits alongside what they already hold, what happens in stress and how they will be kept informed.",
    },
    {
      type: "comparison",
      caption: "From an access standard to a governed-allocation standard",
      left: "Earlier standard",
      right: "Emerging standard",
      rows: [
        ["Product availability", "Selection and curation"],
        ["Thematic exposure", "Portfolio fit"],
        ["Return narrative", "Risk-adjusted allocation rationale"],
        ["Relationship-led introduction", "Documented due diligence"],
        ["Product sheet", "Layered information pathway"],
        ["One-off transaction", "Ongoing monitoring and reporting"],
      ],
    },
    {
      type: "pullquote",
      text: "Opportunity alone is insufficient. It must be accompanied by understanding, selection, risk assessment, governance, execution discipline and ongoing monitoring.",
    },

    { type: "heading", id: "what-investors-look-for", text: "What investors now look for" },
    {
      type: "table",
      caption: "Areas of investor evaluation",
      columns: ["Evaluation area", "What investors want to understand"],
      rows: [
        ["Rationale", "Why the strategy exists and which need it addresses"],
        ["Governance", "Who oversees decisions and how oversight is exercised"],
        ["Investment process", "How opportunities are selected, reviewed and monitored"],
        ["Risk", "Which risks exist and how they are disclosed"],
        ["Liquidity", "How subscriptions, redemptions and notice periods operate"],
        ["Reporting", "What information is provided after commitment, and how often"],
        ["Suitability", "Whom the opportunity is, and is not, appropriate for"],
        ["Conflicts", "How potential conflicts of interest are identified and managed"],
      ],
      layer: "data",
    },

    { type: "heading", id: "governed-allocation-model", text: "A governed allocation model" },
    {
      type: "paragraph",
      text: "Governed allocation is a sequence rather than a single decision. Each layer exists to reduce a specific kind of error: noise at the start, poor fit in the middle, and drift once capital is deployed.",
    },
    {
      type: "table",
      caption: "Layers of a governed allocation model",
      columns: ["Layer", "Function", "Why it matters"],
      rows: [
        ["Market insight", "Identifies relevant themes and conditions", "Places opportunity in context"],
        ["Curation", "Filters strategies and asset classes", "Reduces noise before review"],
        ["Investment review", "Assesses merits, risks and fit", "Tests the thesis against evidence"],
        ["Governance", "Applies oversight, compliance and independent control", "Builds confidence in the process"],
        ["Allocation", "Executes with sizing and liquidity discipline", "Turns intent into position"],
        ["Monitoring and reporting", "Reviews positions and communicates material change", "Sustains accountability over time"],
      ],
    },

    { type: "heading", id: "scenario-analysis", text: "Scenario analysis: why discipline compounds" },
    {
      type: "paragraph",
      text: "The scenario below is deliberately abstract. It does not describe any market, fund or strategy. It shows how a modest difference in an assumed annual rate produces materially different outcomes over five years — and therefore why the assumptions behind any projection deserve as much scrutiny as the projection itself.",
    },
    {
      type: "scenario",
      scenario: {
        id: "allocation-index",
        title: "Hypothetical allocation index under three assumptions",
        metric: "Hypothetical index",
        decimals: 1,
        baseYear: 2026,
        baseValue: 100,
        years: [2026, 2027, 2028, 2029, 2030, 2031],
        scenarios: {
          downside: { rate: 0.03, assumption: "Constant 3% annual rate" },
          base: { rate: 0.06, assumption: "Constant 6% annual rate" },
          upside: { rate: 0.09, assumption: "Constant 9% annual rate" },
        },
        period: "2026–2031",
        dataSource: "Hypothetical index constructed by Nusantara Research for illustration only.",
        methodology:
          "Base value of 100 in 2026 compounded annually at each constant rate. No volatility, fees, taxes or path dependency are modelled.",
      },
    },
    {
      type: "layer",
      layer: "implication",
      title: "Reading the scenario",
      body: [
        "The spread between the downside and upside paths widens every year. Small differences in assumptions — about growth, fees, liquidity or risk — become large differences in outcome. Governance is, in part, the discipline of testing those assumptions before capital is committed.",
      ],
    },

    { type: "heading", id: "information-pathway", text: "A layered information pathway" },
    {
      type: "paragraph",
      text: "Serious investors should not receive every document at once. Information is most useful when it is layered by stage of engagement: context first, then an understanding of the platform and its process, then formal documentation, and only then participation through the appropriate eligibility and suitability process.",
    },
    {
      type: "list",
      ordered: true,
      items: [
        "Market understanding — research and market context",
        "Introduction — how the organisation thinks and works, without constituting an offer",
        "Review — governance, process and strategy overview",
        "Formal documentation — offering documents and risk disclosures",
        "Participation — eligibility, suitability and onboarding",
        "Ongoing relationship — periodic reporting and material updates",
      ],
    },
    {
      type: "callout",
      title: "A note on risk",
      text: "Governance improves the quality and transparency of decisions. It does not eliminate investment risk, and it is not a guarantee of any outcome.",
    },
  ],
  related: ["the-resilience-lens", "alternatives-require-more-discipline", "q4-2026-market-outlook"],
};
