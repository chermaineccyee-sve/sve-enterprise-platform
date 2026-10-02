import type { Insight } from "./types";

export const shariahCapable: Insight = {
  slug: "shariah-capable-allocation-shared-principles",
  title: "Conventional and Shariah-capable allocation: shared principles",
  subtitle: "Two tracks can serve different investor preferences while sharing one standard of governance, disclosure and reporting.",
  category: "Investment Perspectives",
  date: "2026-07-16",
  author: "Nusantara Research",
  summary:
    "A dual-track architecture can accommodate conventional and Shariah-sensitive preferences without creating two standards of discipline.",
  executiveSummary: [
    "Investors bring different principles to allocation. Some require Shariah-compliant exposure; others have ethical or conventional preferences.",
    "A dual-track architecture can serve both, provided the operating principles — governance, suitability, disclosure, liquidity and reporting — are shared.",
    "Shariah-capable allocation should be supported by appropriate screening, adviser oversight and documentation before it is presented as a formal track.",
  ],
  keyTakeaways: [
    "Different tracks, one standard of governance.",
    "Screening and adviser oversight come before product presentation.",
    "Purification and compliance review should be documented and reported.",
  ],
  tags: ["Shariah-capable", "Governance", "Portfolio construction"],
  hero: { motif: "rings" },
  status: "sample",
  sources: [{ label: "Nusantara Research", detail: "Framework developed for this note." }],
  body: [
    { type: "heading", id: "dual-track", text: "A dual-track architecture" },
    {
      type: "paragraph",
      text: "Offering conventional and Shariah-capable allocation side by side is less about product range than about process. Each track must be able to show how opportunities are screened, who provides oversight, and how compliance is confirmed over time.",
    },
    {
      type: "comparison",
      caption: "Shared operating principles across both tracks",
      left: "Conventional allocation",
      right: "Shariah-capable allocation",
      rows: [
        ["Governance visibility", "Governance visibility, plus Shariah adviser oversight"],
        ["Investor suitability", "Investor suitability"],
        ["Risk disclosure", "Risk disclosure, including screening methodology"],
        ["Liquidity alignment", "Liquidity alignment"],
        ["Reporting discipline", "Reporting discipline, including purification where relevant"],
      ],
    },
    {
      type: "layer",
      layer: "implication",
      title: "For allocation",
      body: [
        "A Shariah-capable track should be introduced only once screening, oversight and documentation are in place — not presented ahead of them.",
      ],
    },
    {
      type: "callout",
      title: "Status",
      text: "Shariah-capable allocation is described here as a capability. It is not an offer of any product, and any future offering would be subject to appropriate review and documentation.",
    },
  ],
  related: ["from-access-to-governed-allocation", "alternatives-require-more-discipline", "the-resilience-lens"],
};
