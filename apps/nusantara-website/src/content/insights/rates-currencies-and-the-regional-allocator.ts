import type { Insight } from "./types";

export const ratesCurrencies: Insight = {
  slug: "rates-currencies-and-the-regional-allocator",
  title: "Rates, currencies and the regional allocator",
  subtitle: "Why currency exposure should be a decision, and how we think about duration when the path of policy is uncertain.",
  category: "Macro & Markets",
  date: "2026-08-14",
  author: "Nusantara Investment Team",
  summary:
    "For investors allocating across borders, interest rates and currencies are intertwined. We outline a practical framework for treating both as deliberate choices.",
  executiveSummary: [
    "Rate differentials, policy paths and capital flows all influence currencies. For a cross-border portfolio, currency outcomes can rival asset outcomes in significance.",
    "We separate the asset decision from the currency decision, and document both.",
    "For duration, we assess exposure across a range of policy paths rather than a single expected path.",
  ],
  keyTakeaways: [
    "Currency exposure is frequently taken unintentionally; it should be chosen.",
    "Hedging has costs and benefits that change with rate differentials.",
    "Scenario-based duration assessment is more robust than point forecasts.",
  ],
  tags: ["Rates", "Currencies", "Macro"],
  hero: { motif: "lines" },
  status: "sample",
  sources: [
    { label: "Nusantara Investment Team", detail: "Framework and interpretation." },
    { label: "Nusantara Market Dashboard", detail: "Illustrative prototype dataset used for the chart in this note." },
  ],
  methodology:
    "The chart is drawn from the illustrative dataset used throughout this prototype, rebased to 100, and is included to demonstrate the research template only.",
  body: [
    { type: "heading", id: "two-decisions", text: "Two decisions, not one" },
    {
      type: "paragraph",
      text: "When an investor buys an asset denominated in another currency, two decisions are made at once: one about the asset and one about the currency. The second is often implicit. We prefer to make it explicit — to decide whether to hedge fully, partially or not at all, and to record why.",
    },
    {
      type: "chart",
      caption: "Selected currency pairs, rebased to 100 — illustrative",
      kind: "line",
      xLabels: ["Oct 25", "Nov 25", "Dec 25", "Jan 26", "Feb 26", "Mar 26", "Apr 26", "May 26", "Jun 26", "Jul 26", "Aug 26", "Sep 26"],
      series: [
        { id: "usdmyr", label: "USD/MYR", values: [100, 99.4, 99.1, 98.2, 98.6, 97.9, 97.1, 97.6, 96.8, 96.2, 96.9, 96.4] },
        { id: "usdsgd", label: "USD/SGD", values: [100, 99.7, 99.2, 99.5, 98.8, 98.4, 98.9, 98.1, 97.7, 98.2, 97.6, 97.3] },
        { id: "usdidr", label: "USD/IDR", values: [100, 100.6, 100.2, 101.1, 100.7, 101.4, 100.9, 101.6, 101.2, 100.8, 101.5, 101.1] },
      ],
      decimals: 1,
      source: "Illustrative dataset, Nusantara Market Dashboard (prototype).",
      illustrative: true,
    },
    {
      type: "layer",
      layer: "data",
      title: "What drives currency outcomes",
      body: ["Interest-rate differentials, relative growth, trade balances and portfolio flows all contribute. Their relative influence changes over time."],
    },
    {
      type: "layer",
      layer: "interpretation",
      title: "Our reading",
      body: ["Because the drivers rotate, a currency view held with high conviction is rarely warranted. A documented policy is more durable than a forecast."],
    },
    {
      type: "layer",
      layer: "implication",
      title: "For allocation",
      body: ["Hedging decisions should consider the cost implied by rate differentials, the investor’s base currency and the horizon of the underlying asset."],
    },
    { type: "heading", id: "duration", text: "Duration across paths" },
    {
      type: "paragraph",
      text: "We assess duration against several policy paths — faster, slower and broadly as anticipated — and ask how an income allocation would behave in each. A position that only works under one path is a forecast, not a framework.",
    },
    {
      type: "callout",
      title: "Not a recommendation",
      text: "This note describes a framework for analysis and does not constitute a view on, or recommendation regarding, any currency or security.",
    },
  ],
  related: ["q4-2026-market-outlook", "the-resilience-lens", "from-access-to-governed-allocation"],
};
