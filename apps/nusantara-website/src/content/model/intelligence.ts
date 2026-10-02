/**
 * Nusantara intelligence model — interpretation, kept separate from market
 * data at the data-model level.
 *
 *   MARKET DATA (lib/market)  →  SIGNALS  →  NUSANTARA VIEW  →  INSIGHTS
 *
 * Market data says what happened and comes from a provider. Everything in
 * this file is Nusantara's reading of it: authored, reviewed, approved,
 * published and eventually archived (see ./publication.ts). Each type maps
 * one-to-one to a future CMS content type (docs/ARCHITECTURE.md).
 */
import type { AssetClass } from "@/lib/market/types";
import type { Publication } from "./publication";

/** A five-step qualitative scale, low → high, and the current position on it. */
export type Stance = {
  scale: [string, string, string, string, string];
  position: 0 | 1 | 2 | 3 | 4;
};

/**
 * What a view is about. Instrument views take precedence; an asset-class
 * view applies to instruments without their own. Indicator views carry the
 * reading of a structural indicator.
 */
export type ViewSubject =
  | { kind: "instrument"; id: string }
  | { kind: "assetClass"; id: AssetClass }
  | { kind: "indicator"; id: string };

/** NUSANTARA VIEW — Market View content type. */
export type NusantaraView = Publication & {
  id: string;
  subject: ViewSubject;
  /** One word or short phrase, e.g. "Selective". Null for indicator readings. */
  signal: string | null;
  stance: Stance | null;
  /** One-line summary used in cross-asset comparisons. */
  summary: string | null;
  context: string;
  whatWeAreWatching: string[];
  keyRisk: string | null;
  whatWouldChangeOurView: string | null;
  /** Instrument ids, in display order. */
  relatedMarkets: string[];
  /** Insight slug. */
  relatedInsight: string | null;
  /** Theme id. */
  theme: string | null;
  /** Market State dimensions this view reads into (ids), most relevant first. */
  marketStateDimensions?: string[];
};

/** One dimension of the Market State. */
export type MarketStateDimension = {
  id: string;
  label: string;
  state: string;
  stance: Stance;
  summary: string;
  watchItems: string[];
  changeConditions: string;
  /** Instrument ids. */
  supportingMarkets: string[];
  /** Insight slug. */
  relatedInsight: string | null;
  updatedAt: string;
  status: Publication["status"];
};

/** NUSANTARA MARKET STATE — published as a whole edition. */
export type MarketStateEdition = Publication & {
  id: string;
  /** Edition name, e.g. "October 2026". */
  edition: string;
  /**
   * Framing shown for sample/demonstration editions. Null for a published
   * house view, which shows its publication stamp instead.
   */
  framing: { title: string; note: string } | null;
  dimensions: MarketStateDimension[];
};

/** A short, dated signal — what we are watching, briefly. */
export type Signal = Publication & {
  id: string;
  /** ISO date shown with the signal. */
  date: string;
  theme: string;
  headline: string;
  reading: string;
  /** Instrument id. */
  instrument?: string;
  /** Insight slug. */
  insight: string | null;
};

/** A research theme joining insights to markets and indicators. */
export type Theme = Publication & {
  id: string;
  title: string;
  statement: string;
  /** Curated research for the theme, in display order (insight slugs). */
  insights: string[];
  /** Instrument ids. */
  instruments: string[];
  /** Structural indicator ids. */
  indicators: string[];
};

/** A market Nusantara monitors (a country or region), joining its instruments. */
export type MonitoredMarket = {
  id: string;
  name: string;
  /** Position on a stylised 0–100 canvas — schematic, not geographic. */
  x: number;
  y: number;
  index: string | null;
  currency: string | null;
  rate: string | null;
  /** Insight slug. */
  insight: string | null;
};
