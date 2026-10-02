/**
 * The Nusantara View — editorial interpretation module.
 * Readings are framework statements, not recommendations or forecasts.
 */
export const NUSANTARA_VIEW = {
  edition: "October 2026",
  status: "sample" as const,
  title: "Market environment",
  intro:
    "Our reading of the environment, area by area. These are interpretive themes that frame how we think — not recommendations, and not forecasts.",
  areas: [
    {
      area: "Growth",
      theme: "Uneven",
      text: "Momentum appears to vary across economies and sectors. We place more weight on breadth than on headline aggregates.",
    },
    {
      area: "Rates",
      theme: "Path-dependent",
      text: "Direction attracts attention; for income allocation, the speed and sequencing of policy change matter more.",
    },
    {
      area: "Currencies",
      theme: "Deliberate",
      text: "Currency exposure should be a documented decision, not a by-product of asset selection.",
    },
    {
      area: "Equities",
      theme: "Selective",
      text: "Where leadership is narrow, dispersion creates room for selection — and risk for undifferentiated exposure.",
    },
    {
      area: "Commodities",
      theme: "Resilience role",
      text: "We consider precious metals principally through a portfolio-resilience lens rather than as a tactical position.",
    },
    {
      area: "Private Markets",
      theme: "Terms first",
      text: "Where capital is plentiful, pricing discipline, structure and underwriting quality matter more than deployment pace.",
    },
  ],
};
