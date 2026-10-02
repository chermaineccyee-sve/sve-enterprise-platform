import type { InsightListing } from "@/content/insights/types";
import type { NusantaraView } from "@/content/model/intelligence";

/**
 * Everything the dashboard shows beside an instrument's market data, resolved
 * on the server by the relationship engine (src/lib/content/relationships.ts).
 */
export type MarketIntel = {
  /** The Nusantara View that applies (instrument, else asset class), or null. */
  view: NusantaraView | null;
  /** Related instrument ids, in display order. */
  relatedMarkets: string[];
  /** The most relevant visible insight, or null ("no related research"). */
  insight: InsightListing | null;
};
