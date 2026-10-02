import type { Insight } from "./types";

export const tokenisation: Insight = {
  slug: "tokenisation-a-framework-first-approach",
  title: "Tokenisation: a framework-first approach",
  subtitle: "Digital assets and tokenised real-world assets are not one asset class. We distinguish technology narrative from investment-grade readiness.",
  category: "Research Notes",
  date: "2026-07-30",
  author: "Nusantara Research",
  summary:
    "Tokenisation may improve access, settlement and operational efficiency in selected cases. It does not remove the need for legal clarity, custody control, liquidity depth and investor protection.",
  executiveSummary: [
    "Digital assets and tokenised real-world assets are increasingly discussed in private wealth. Adoption at investment grade remains selective.",
    "The category spans very different exposures, each with its own requirements. Treating it as a single asset class obscures more than it reveals.",
    "Our approach is framework-first: no exposure is considered until its legal, custody, liquidity and regulatory questions have satisfactory answers.",
  ],
  keyTakeaways: [
    "Technology can change how an asset is held; it does not change what the asset is.",
    "Legal title and enforceability come before efficiency gains.",
    "This is an area of future review, not current allocation.",
  ],
  tags: ["Digital assets", "Tokenisation", "Research note"],
  hero: { motif: "grid" },
  status: "sample",
  sources: [{ label: "Nusantara Research", detail: "Framework developed for this note." }],
  body: [
    { type: "heading", id: "not-one-class", text: "Not one asset class" },
    {
      type: "paragraph",
      text: "Discussion of digital assets often groups together exposures with little in common. A tokenised claim on a physical asset, a stablecoin and a protocol yield product differ in what they represent, who stands behind them and how they fail. Each warrants its own assessment.",
    },
    {
      type: "table",
      caption: "Themes and investment-grade requirements",
      columns: ["Theme", "Investment-grade requirement"],
      rows: [
        ["Crypto-asset exposure", "Volatility assessment, custody, suitability and regulatory clarity"],
        ["Stablecoins", "Reserve quality, issuer risk, redemption risk and regulatory treatment"],
        ["Tokenised real-world assets", "Legal title, enforceability, liquidity and custody"],
        ["Precious metals tokenisation", "Physical backing, custody audit, redemption rights and ownership clarity"],
        ["Blockchain settlement", "Operational reliability, legal recognition and counterparty control"],
        ["Staking and yield products", "Protocol risk, lock-up, counterparty risk and suitability"],
      ],
      layer: "data",
    },
    {
      type: "layer",
      layer: "interpretation",
      title: "Our reading",
      body: ["Exposure to this area may become more relevant over time. Disciplined allocators should distinguish between a technology narrative and investment-grade readiness."],
    },
    {
      type: "layer",
      layer: "implication",
      title: "For allocation",
      body: ["We treat tokenised real-world assets as an area of future review only, subject to legal, custody and governance requirements being satisfied."],
    },
    {
      type: "callout",
      title: "Risk",
      text: "Digital assets can be highly volatile and may be subject to custody, counterparty, legal and regulatory risks, including the total loss of capital.",
    },
  ],
  related: ["alternatives-require-more-discipline", "the-resilience-lens", "from-access-to-governed-allocation"],
};
