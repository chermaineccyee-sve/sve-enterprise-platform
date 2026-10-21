import type { InsightListing } from "@/content/insights/types";
import type { NusantaraView } from "./intelligence";

/**
 * Everything shown beside an instrument's market data, resolved on the server
 * by the relationship engine (src/lib/content/relationships.ts):
 *
 *   MARKET → NUSANTARA VIEW → MARKET STATE → INSIGHT → CAPABILITY
 */
export type MarketIntel = {
  /** The Nusantara View that applies (instrument, else asset class), or null. */
  view: NusantaraView | null;
  /** Related instrument ids, in display order. */
  relatedMarkets: string[];
  /** The most relevant visible insight, or null ("no related research"). */
  insight: InsightListing | null;
  /** Market State dimensions connected to this market (at most two). */
  dimensions: { id: string; label: string; state: string }[];
  /** Capabilities connected to this market (at most two). */
  capabilities: { slug: string; name: string }[];
};
