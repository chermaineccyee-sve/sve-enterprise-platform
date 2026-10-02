import type { Insight } from "./types";

export const preciousMetals: Insight = {
  slug: "precious-metals-and-portfolio-resilience",
  title: "Precious metals and portfolio resilience",
  subtitle: "Why we frame gold as a resilience component rather than a tactical position — and what that framing requires.",
  category: "Alternative Investments",
  date: "2026-09-24",
  author: "Nusantara Research",
  summary:
    "Precious metals do not pay income and can be volatile. Their case rests on how they behave alongside other assets, which is why the framing — and the custody behind it — matters more than the price.",
  executiveSummary: [
    "Gold has historically been held for reserve and diversification characteristics rather than for income. We consider it principally through a portfolio-resilience lens.",
    "A resilience framing changes the questions we ask: not where the price goes next, but what role the exposure plays when other assets are under stress.",
    "The form of exposure matters. Physical backing, custody, title and redemption rights determine whether a precious-metals holding actually delivers the resilience it is meant to.",
  ],
  keyTakeaways: [
    "Resilience role, not tactical trade.",
    "Judge the exposure by its behaviour alongside other assets.",
    "Custody, title and redemption rights are part of the investment case.",
    "No income: the opportunity cost rises when real yields are high.",
  ],
  tags: ["Precious metals", "Gold", "Resilience", "Custody"],
  hero: { motif: "rings" },
  status: "sample",
  sources: [
    { label: "Nusantara Research", detail: "Framework and interpretation developed for this note." },
    { label: "Nusantara Market Dashboard", detail: "Illustrative prototype dataset used for the chart in this note." },
  ],
  methodology:
    "The chart uses the illustrative dataset from this prototype, rebased to 100, and demonstrates the research template only. It does not describe actual market prices.",
  body: [
    { type: "heading", id: "framing", text: "A question of framing" },
    {
      type: "paragraph",
      text: "Most discussion of gold begins with its price. We begin with its role. An asset held for resilience is judged differently from one held for return: by how it behaves when other parts of a portfolio are under pressure, and by whether it can be relied upon — legally and operationally — when it is needed.",
    },
    {
      type: "chart",
      caption: "Gold and silver, rebased to 100 — illustrative",
      kind: "line",
      xLabels: ["Oct 25", "Nov 25", "Dec 25", "Jan 26", "Feb 26", "Mar 26", "Apr 26", "May 26", "Jun 26", "Jul 26", "Aug 26", "Sep 26"],
      series: [
        { id: "gold", label: "Gold", values: [100, 101.8, 103.1, 102.4, 105.2, 107.9, 106.6, 109.4, 111.8, 110.9, 113.6, 115.2] },
        { id: "silver", label: "Silver", values: [100, 103.4, 101.2, 104.8, 108.9, 106.1, 110.7, 114.2, 109.8, 113.5, 117.9, 116.4] },
      ],
      decimals: 1,
      source: "Illustrative dataset, Nusantara Market Dashboard (prototype).",
      illustrative: true,
    },
    {
      type: "layer",
      layer: "data",
      title: "What the series shows",
      body: ["In this illustrative series, silver moves further than gold in both directions — consistent with its dual role as a precious and an industrial metal."],
    },
    {
      type: "layer",
      layer: "interpretation",
      title: "Our reading",
      body: [
        "Where reserve-diversification demand is sustained, it supports viewing precious metals as a structural resilience component. Higher volatility makes silver a weaker candidate for that role.",
      ],
    },
    {
      type: "layer",
      layer: "implication",
      title: "For allocation",
      body: ["Size precious metals for the role they play in stress, not for the return they might deliver in a rally — and confirm custody and title before anything else."],
    },
    { type: "heading", id: "form-of-exposure", text: "The form of exposure" },
    {
      type: "table",
      caption: "What to verify, by form of exposure",
      columns: ["Form", "Key question", "Why it matters"],
      rows: [
        ["Physically backed holding", "Is the metal allocated, audited and insured?", "Determines whether the holding exists as stated"],
        ["Listed instrument", "What does the instrument hold, and who is the counterparty?", "Exposure may be synthetic or carry counterparty risk"],
        ["Tokenised claim", "Are legal title and redemption rights enforceable?", "Technology does not replace legal ownership"],
      ],
      layer: "data",
    },
    { type: "pullquote", text: "Resilience that cannot be relied upon in stress is not resilience. Custody is part of the investment case." },
    {
      type: "callout",
      title: "Risk",
      text: "Precious metals can be volatile, generate no income and may be subject to custody, counterparty and currency risks. This note is not a recommendation.",
    },
  ],
  related: ["the-resilience-lens", "alternatives-require-more-discipline"],
  relatedInstruments: ["gold", "silver"],
};
