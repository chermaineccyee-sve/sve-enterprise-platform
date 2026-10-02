/**
 * Market data contracts.
 *
 * Every UI component consumes these types only — never a provider directly.
 * Replacing the illustrative provider with an authorised feed (exchange
 * feeds, statistical APIs, or a licensed vendor) means implementing
 * `MarketDataProvider` and registering it in `service.ts`. No component
 * changes are required.
 */

/** How a value should be represented to the public. Always displayed. */
export type DataStatus = "live" | "delayed" | "end-of-day" | "illustrative" | "placeholder";

export type AssetClass = "equities" | "fx" | "rates" | "commodities";

export const CHART_PERIODS = ["1D", "1W", "1M", "3M", "YTD", "1Y"] as const;
export type ChartPeriod = (typeof CHART_PERIODS)[number];

export type ChangeConvention =
  /** Price instruments: absolute change and percentage change. */
  | "price"
  /** Yields: change expressed in basis points; percentage change is not meaningful. */
  | "yield";

export interface InstrumentDefinition {
  id: string;
  name: string;
  shortName: string;
  /** Display ticker / identifier. Vendor symbols are mapped inside providers. */
  ticker: string;
  assetClass: AssetClass;
  region: "Asia" | "Americas" | "Europe" | "Global";
  /** Unit shown beside the value, e.g. "USD/oz", "%". */
  unit?: string;
  decimals: number;
  convention: ChangeConvention;
  description: string;
}

export interface PricePoint {
  /** ISO 8601 timestamp. */
  t: string;
  v: number;
}

/** Where a number came from and how current it is. */
export interface DataProvenance {
  source: string;
  status: DataStatus;
  /** ISO 8601 timestamp of the observation. */
  asOf: string;
  /** For delayed data: delay in minutes, displayed alongside the status. */
  delayMinutes?: number;
  /** Optional attribution / licence wording required by a vendor. */
  attribution?: string;
}

export interface Quote {
  value: number;
  previousClose: number;
  /** value - previousClose (in the instrument's units; for yields, in % points). */
  change: number;
  /** Percentage change. Null where not meaningful (yields). */
  changePct: number | null;
  /** For yields: change in basis points. */
  changeBp: number | null;
}

export interface InstrumentSnapshot {
  instrument: InstrumentDefinition;
  quote: Quote;
  provenance: DataProvenance;
}

export interface InstrumentHistory {
  instrumentId: string;
  period: ChartPeriod;
  points: PricePoint[];
}

export interface MarketSnapshot {
  provenance: DataProvenance;
  /** Disclaimer wording supplied by the provider configuration. */
  disclaimer: string;
  instruments: InstrumentSnapshot[];
}

/* ------------------------------------------------------------------ */
/* Level B — strategic market intelligence                             */
/* ------------------------------------------------------------------ */

export const INTELLIGENCE_CATEGORIES = [
  "Asset Management",
  "Private Markets",
  "Alternative Assets",
  "Capital Flows",
  "Private Wealth",
  "Family Office & Institutional Capital",
  "Macro Indicators",
] as const;
export type IntelligenceCategory = (typeof INTELLIGENCE_CATEGORIES)[number];

export type Direction = "rising" | "stable" | "easing";

export interface IntelligenceIndicator {
  id: string;
  category: IntelligenceCategory;
  title: string;
  /** What the number measures, e.g. "Illustrative index (2022 = 100)". */
  measure: string;
  value: number;
  decimals: number;
  unit?: string;
  /** Reporting period of the latest observation, e.g. "Q2 2026". */
  period: string;
  direction: Direction;
  /** Short series for a trend line (oldest → newest). */
  series: { label: string; v: number }[];
  /** Nusantara's interpretation layer — what it may mean. */
  reading: string;
  provenance: DataProvenance;
}

export interface IntelligenceSnapshot {
  provenance: DataProvenance;
  disclaimer: string;
  indicators: IntelligenceIndicator[];
}

/* ------------------------------------------------------------------ */

export interface MarketDataProvider {
  id: string;
  getSnapshot(): Promise<MarketSnapshot>;
  getHistory(period: ChartPeriod, instrumentIds?: string[]): Promise<InstrumentHistory[]>;
  getIntelligence(): Promise<IntelligenceSnapshot>;
  /** Suggested client refresh interval in ms; null disables polling. */
  refreshIntervalMs: number | null;
}
