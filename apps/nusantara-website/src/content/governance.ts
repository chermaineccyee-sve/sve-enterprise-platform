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

/** The path every investment decision travels — used by the interactive governance flow. */
export const DECISION_GATES = [
  {
    id: "signal",
    title: "Market signal",
    question: "Is there something worth examining?",
    purpose: "Market intelligence identifies a condition or opportunity and states why it may matter.",
    stops: "Noise — moves without a reason to act.",
  },
  {
    id: "investment-review",
    title: "Investment review",
    question: "Does the evidence support the thesis?",
    purpose: "The opportunity is assessed on return drivers, downside cases, liquidity terms and valuation method.",
    stops: "Narratives that the evidence does not support.",
  },
  {
    id: "risk-review",
    title: "Risk review",
    question: "What could go wrong, and how badly?",
    purpose: "Risks are identified and assessed independently of the people proposing the opportunity.",
    stops: "Risks that are unmeasured, unexplained or out of proportion.",
  },
  {
    id: "governance",
    title: "Governance",
    question: "Has it been subjected to independent challenge?",
    purpose: "Oversight and compliance review apply approvals, screening and separation of duties before any commitment.",
    stops: "Decisions without accountability or proper approval.",
  },
  {
    id: "allocation",
    title: "Allocation",
    question: "Is it sized and structured appropriately?",
    purpose: "Capital is committed with attention to position size, liquidity alignment, concentration and suitability.",
    stops: "Positions sized for conviction rather than uncertainty.",
  },
  {
    id: "monitoring",
    title: "Monitoring",
    question: "Does the thesis still hold?",
    purpose: "Positions are reviewed against the reasons they were taken, on a defined cycle.",
    stops: "Drift — positions held after their rationale has gone.",
  },
  {
    id: "reporting",
    title: "Reporting",
    question: "Do investors understand what has happened?",
    purpose: "Clear, layered reporting and prompt communication of material change.",
    stops: "Opacity.",
  },
] as const;
