/** Investment operating model — public-suitable, function-level descriptions. */
export const PROCESS_STEPS = [
  {
    n: "01",
    id: "market-insight",
    title: "Market Insight",
    question: "What is happening, and why does it matter?",
    text: "We begin with the market environment: macro conditions, asset-class dynamics and structural shifts in capital. Context comes before opportunity.",
  },
  {
    n: "02",
    id: "opportunity-curation",
    title: "Opportunity Curation",
    question: "Is this worth our attention?",
    text: "Potential strategies and asset classes are filtered to reduce noise. We aim to be curated, not crowded — fewer opportunities, better understood.",
  },
  {
    n: "03",
    id: "investment-review",
    title: "Investment Review",
    question: "Does the evidence support the thesis?",
    text: "Each opportunity is assessed on its merits, risks, liquidity, valuation approach and fit within a portfolio, against defined criteria.",
  },
  {
    n: "04",
    id: "risk-governance",
    title: "Risk & Governance",
    question: "Has it been appropriately reviewed and challenged?",
    text: "Opportunities pass through oversight, compliance review and risk assessment before any commitment is made. Governance is part of the process, not an afterthought.",
  },
  {
    n: "05",
    id: "allocation-execution",
    title: "Allocation & Execution",
    question: "Is the position sized and structured appropriately?",
    text: "Capital is allocated with sizing and liquidity discipline, through documented processes and appropriate eligibility and suitability checks.",
  },
  {
    n: "06",
    id: "monitoring-reporting",
    title: "Monitoring & Reporting",
    question: "Does the thesis still hold?",
    text: "Positions are reviewed against their original rationale. Material change is identified early and communicated clearly.",
  },
] as const;

export const ACCESS_TO_ALLOCATION = [
  { term: "Access", note: "Opportunity is reachable" },
  { term: "Selection", note: "Chosen for a reason" },
  { term: "Curation", note: "Filtered for relevance" },
  { term: "Governance", note: "Subjected to oversight" },
  { term: "Allocation", note: "Sized with discipline" },
  { term: "Monitoring", note: "Reviewed over time" },
] as const;

export const APPROACH_COMPARISON: [string, string][] = [
  ["Availability", "Selection"],
  ["Theme", "Portfolio fit"],
  ["Product access", "Governed allocation"],
  ["Product sheet", "Information pathway"],
  ["Transaction", "Ongoing monitoring"],
];

export const PRINCIPLES = [
  { title: "Curated, not crowded", text: "We would rather understand a small number of opportunities well than offer many superficially." },
  { title: "Modular, not scattered", text: "Capabilities are developed progressively, each with its own governance, documentation and risk controls." },
  { title: "Governed, not promotional", text: "We explain how decisions are made and overseen, rather than relying on the appeal of an opportunity." },
  { title: "Clear, not complex", text: "Information should be layered and plainly expressed, so that investors understand before they participate." },
] as const;

export const PILLARS = [
  { n: "01", title: "Curation", text: "Selecting relevant and suitable opportunities." },
  { n: "02", title: "Governance", text: "Oversight, process and control." },
  { n: "03", title: "Execution", text: "Disciplined allocation and administration." },
  { n: "04", title: "Communication", text: "Clarity for investors and their advisers." },
] as const;

export const INFORMATION_PATHWAY = [
  { stage: "Market understanding", detail: "Research and market context" },
  { stage: "Introduction", detail: "How Nusantara thinks and works — not an offer" },
  { stage: "Review", detail: "Governance, process and strategy overview" },
  { stage: "Formal documentation", detail: "Offering documents and risk disclosures" },
  { stage: "Participation", detail: "Eligibility, suitability and onboarding" },
  { stage: "Ongoing relationship", detail: "Periodic reporting and material updates" },
] as const;

export const RESILIENCE_CONCEPTS = [
  { title: "Liquidity alignment", text: "Commitments matched to the ability to meet them." },
  { title: "Valuation discipline", text: "Methodology understood and applied consistently." },
  { title: "Risk assessment", text: "Downside defined before upside is pursued." },
  { title: "Suitability", text: "Appropriate opportunities for the investor concerned." },
  { title: "Monitoring", text: "Assumptions reviewed on a defined cycle." },
  { title: "Governance oversight", text: "Review and challenge built into the process." },
] as const;
