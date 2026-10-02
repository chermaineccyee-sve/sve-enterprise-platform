/**
 * Market data contracts.
 *
 * Every UI component consumes these types only — never a provider directly.
 * Replacing the illustrative provider with an authorised feed (an approved
 * API or a licensed enterprise vendor) means implementing
 * `MarketDataProvider` and registering it in `service.ts`. No component
 * changes are required.
 */

/**
 * How a value may be represented to the public. Always displayed.
 *
 *  - illustrative: generated for demonstration; never market data
 *  - delayed:      from an authorised source with a stated delay (incl. end-of-day closes)
 *  - live:         streamed from an authorised source
 *  - unavailable:  no value may be shown (feed down, not licensed for display, or not supplied)
 */
export const DATA_STATUSES = ["illustrative", "delayed", "live", "unavailable"] as const;
export type DataStatus = (typeof DATA_STATUSES)[number];

/** Whether the licence permits public display of a value. */
export type DisplayLicence = "public" | "restricted";

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
  /** Market the instrument belongs to, e.g. "Malaysia", "United States", "Global". */
  market: string;
  /** Currency the value is quoted in (ISO 4217), or the quote currency of an FX pair. */
  currency: string;
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

/** Where a number came from, how current it is, and whether it may be shown. */
export interface DataProvenance {
  /** Display name of the source, shown on every data surface. */
  source: string;
  /** Provider id, e.g. "illustrative", "http". */
  provider?: string;
  status: DataStatus;
  /** ISO 8601 timestamp of the observation. */
  asOf: string;
  /** ISO 8601 timestamp at which Nusantara retrieved it. */
  retrievedAt?: string;
  /** For delayed data: delay in minutes, displayed alongside the status. */
  delayMinutes?: number;
  /**
   * Age (minutes) after which a delayed or live value is stale. Stale values
   * are labelled as such and never presented as current.
   */
  staleAfterMinutes?: number;
  /** Optional attribution / licence wording required by a vendor. */
  attribution?: string;
  /** Licensing / display status. Defaults to "public" when omitted. */
  licence?: DisplayLicence;
  /** Licensing note for compliance review (not displayed unless required). */
  licensingNote?: string;
  /** How the value is produced, where relevant. */
  methodology?: string;
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

/** An instrument in the catalogue for which no value may be shown. */
export interface UnavailableInstrument {
  instrument: InstrumentDefinition;
  reason: "service-unavailable" | "not-supplied" | "not-licensed" | "invalid";
}

export interface MarketSnapshot {
  provenance: DataProvenance;
  /** Disclaimer wording supplied by the provider configuration. */
  disclaimer: string;
  /** Instruments with a displayable value. */
  instruments: InstrumentSnapshot[];
  /** Catalogue instruments with no displayable value. Never given invented numbers. */
  unavailable: UnavailableInstrument[];
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
  /** Human-readable name used in source lines, e.g. "Illustrative dataset (prototype)". */
  label: string;
  getSnapshot(): Promise<MarketSnapshot>;
  getHistory(period: ChartPeriod, instrumentIds?: string[]): Promise<InstrumentHistory[]>;
  getIntelligence(): Promise<IntelligenceSnapshot>;
  /** Suggested client refresh interval in ms; null disables polling. */
  refreshIntervalMs: number | null;
}
