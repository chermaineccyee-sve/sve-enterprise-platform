/**
 * Governance architecture at function level only. Named bodies, committees,
 * people and service providers are intentionally absent until approved.
 */
export const GOVERNANCE_LAYERS = [
  {
    n: "01",
    title: "Oversight",
    text: "Direction, approvals and accountability for the platform and its investment activity.",
  },
  {
    n: "02",
    title: "Investment Review",
    text: "Structured assessment of opportunities against defined criteria before any commitment.",
  },
  {
    n: "03",
    title: "Risk Management",
    text: "Identification, assessment and monitoring of investment, liquidity and operational risk.",
  },
  {
    n: "04",
    title: "Compliance",
    text: "Investor screening, anti-money-laundering controls and adherence to applicable requirements.",
  },
  {
    n: "05",
    title: "Independent Controls",
    text: "Audit, custody and safekeeping functions kept separate from investment decision-making.",
  },
  {
    n: "06",
    title: "Administration & Operational Controls",
    text: "Valuation, records, investor administration and the processes that support them.",
  },
  {
    n: "07",
    title: "Reporting & Monitoring",
    text: "Ongoing communication with investors and periodic review of positions and controls.",
  },
] as const;
