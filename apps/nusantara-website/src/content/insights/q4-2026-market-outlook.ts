import type { Insight } from "./types";

export const q4MarketOutlook: Insight = {
  slug: "q4-2026-market-outlook",
  title: "Market outlook: discipline in an uneven cycle",
  subtitle: "A framework for the final quarter of 2026 — what we are watching across growth, rates, currencies, equities and commodities.",
  category: "Market Outlook",
  date: "2026-10-01",
  author: "Nusantara Investment Team",
  summary:
    "Rather than a single forecast, we set out the indicators we are watching, how we would interpret them, and what each would imply for allocation discipline.",
  executiveSummary: [
    "We approach the final quarter without a single directional call. Momentum appears uneven across economies and sectors, and we place more weight on dispersion than on aggregates.",
    "Our framework distinguishes what the data shows, how we interpret it and what it implies for allocation. Where the evidence is mixed, we prefer to say so.",
    "The common thread is discipline: position sizes that reflect uncertainty, liquidity that matches commitments, and regular review against stated assumptions.",
  ],
  keyTakeaways: [
    "Dispersion across markets matters more than headline averages.",
    "The path of policy matters as much as its direction.",
    "Currency exposure should be a deliberate decision, not a by-product.",
    "In uncertain conditions, liquidity alignment is itself a source of resilience.",
  ],
  tags: ["Outlook", "Growth", "Rates", "Currencies", "Commodities"],
  hero: { motif: "lines" },
  featured: true,
  status: "sample",
  sources: [
    { label: "Nusantara Investment Team", detail: "Framework and interpretation." },
    { label: "Nusantara Market Dashboard", detail: "Illustrative prototype dataset. To be replaced with attributed data before publication." },
  ],
  methodology:
    "This outlook is framework-led. Charts reference the illustrative dataset used throughout this prototype and are included to demonstrate the research template, not to describe current market conditions.",
  body: [
    { type: "heading", id: "approach", text: "How we frame the quarter" },
    {
      type: "paragraph",
      text: "Quarterly outlooks often begin with a forecast. We begin with a list of questions. For each area of the market we set out what we are watching, how we would read a change, and what it would mean for the way we allocate. This keeps our assumptions explicit and makes it easier to recognise when they no longer hold.",
    },
    {
      type: "chart",
      caption: "Regional growth momentum — illustrative composite (50 = neutral)",
      kind: "line",
      xLabels: ["Q3 23", "Q4 23", "Q1 24", "Q2 24", "Q3 24", "Q4 24", "Q1 25", "Q2 25", "Q3 25", "Q4 25", "Q1 26", "Q2 26"],
      series: [{ id: "growth", label: "Growth momentum", values: [50.6, 51.2, 50.4, 50.1, 51.5, 51.9, 50.8, 50.6, 51.6, 51.8, 50.9, 51.4] }],
      decimals: 1,
      source: "Illustrative composite, Nusantara Market Dashboard (prototype).",
      illustrative: true,
    },
    {
      type: "layer",
      layer: "data",
      title: "Growth",
      body: [
        "We watch the breadth of activity indicators and earnings revisions rather than any single release. A composite hovering near neutral can conceal sharp differences between sectors and economies.",
      ],
    },
    {
      type: "layer",
      layer: "interpretation",
      title: "Our reading",
      body: [
        "Where momentum is uneven, broad exposure can dilute the opportunities that do exist. Selectivity becomes more valuable than market-level conviction.",
      ],
    },
    {
      type: "layer",
      layer: "implication",
      title: "For allocation",
      body: ["We favour clearly articulated theses with defined review points over broad directional positioning."],
    },

    { type: "heading", id: "inflation-scenarios", text: "Inflation pressure: three paths" },
    {
      type: "paragraph",
      text: "Rather than forecast inflation, we set out three paths for an illustrative inflation-pressure composite and ask how an income allocation would behave under each. The exercise is about the robustness of a position, not about which path is most likely.",
    },
    {
      type: "scenario",
      scenario: {
        id: "inflation-paths",
        title: "Inflation-pressure composite under three illustrative paths",
        metric: "Illustrative composite (50 = neutral)",
        decimals: 1,
        baseYear: 2026,
        baseValue: 48.9,
        years: [0, 1, 2, 3, 4, 5],
        periodLabels: ["Q2 26", "Q3 26", "Q4 26", "Q1 27", "Q2 27", "Q3 27"],
        scenarios: {
          downside: { label: "Persistent", assumption: "Pressure re-builds as energy and food costs firm", values: [48.9, 49.6, 50.4, 51.1, 51.6, 51.9] },
          base: { label: "Gradual", assumption: "Pressure eases slowly and unevenly", values: [48.9, 48.6, 48.2, 47.9, 47.7, 47.6] },
          upside: { label: "Faster easing", assumption: "Broad-based disinflation", values: [48.9, 48.1, 47.2, 46.4, 45.9, 45.6] },
        },
        period: "Q2 2026 – Q3 2027",
        dataSource: "Illustrative composite from the Nusantara Market Dashboard prototype; paths constructed by Nusantara for demonstration.",
        methodology:
          "Each path is a hand-specified sequence from a common starting value. The composite is not a published statistic and the paths carry no probabilities.",
      },
    },
    {
      type: "layer",
      layer: "implication",
      title: "Reading the paths",
      body: [
        "An income allocation that only performs under the faster-easing path is a forecast, not a framework. We prefer positions whose rationale survives the persistent path too.",
      ],
    },
    { type: "heading", id: "rates", text: "Rates and policy" },
    {
      type: "paragraph",
      text: "The direction of policy rates attracts the most attention, but for income-oriented allocation the path matters more: the speed of change, its sequencing across economies, and how far markets have already anticipated it. We assess duration exposure against a range of paths rather than a single expected one.",
    },
    { type: "heading", id: "currencies", text: "Currencies" },
    {
      type: "paragraph",
      text: "For investors with obligations in more than one currency, foreign exchange is a source of risk that is frequently taken unintentionally. We treat currency exposure as a deliberate decision — hedged, partially hedged or open — documented alongside the reason for it.",
    },
    { type: "heading", id: "equities", text: "Equities" },
    {
      type: "paragraph",
      text: "Equity markets can be driven for extended periods by a narrow set of companies or themes. We watch concentration and valuation dispersion, and distinguish between price moves driven by flows and those driven by changes in fundamentals.",
    },
    { type: "heading", id: "commodities", text: "Commodities and real assets" },
    {
      type: "paragraph",
      text: "Commodities respond to supply conditions, inventories and geopolitics as much as to demand. We consider precious metals primarily through a portfolio-resilience lens, and energy and agricultural commodities through their links to inflation and to regional economies.",
    },
    {
      type: "table",
      caption: "Summary framework for the quarter",
      columns: ["Area", "What we are watching", "What a change would imply"],
      rows: [
        ["Growth", "Breadth of activity and earnings revisions", "Selectivity over broad exposure"],
        ["Rates", "Path and sequencing of policy", "Duration assessed across scenarios"],
        ["Currencies", "Rate differentials and flows", "Deliberate, documented FX exposure"],
        ["Equities", "Concentration and valuation dispersion", "Position sizing that reflects uncertainty"],
        ["Commodities", "Supply, inventories and reserve demand", "Resilience role, not tactical trading"],
        ["Private markets", "Pricing discipline and deployment pace", "Manager and transaction selection"],
      ],
      layer: "interpretation",
    },
    {
      type: "pullquote",
      text: "When the evidence is mixed, the disciplined response is not a bolder forecast but a clearer set of assumptions — and a commitment to revisit them.",
    },
    {
      type: "callout",
      title: "Not a recommendation",
      text: "This outlook describes a framework for analysis. It is not a recommendation to buy, sell or hold any security or asset class, and it is not a forecast of returns.",
    },
  ],
  related: ["rates-currencies-and-the-regional-allocator", "precious-metals-and-portfolio-resilience", "the-resilience-lens"],
  relatedInstruments: ["klci", "us10y", "brent"],
};
