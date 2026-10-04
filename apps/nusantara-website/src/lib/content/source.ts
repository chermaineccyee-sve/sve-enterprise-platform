import "server-only";
import { MARKET_STATE_EDITIONS } from "@/content/data/market-state";
import { MARKET_VIEWS } from "@/content/data/market-views";
import { SIGNALS } from "@/content/data/signals";
import { THEMES } from "@/content/data/themes";
import { getAllInsights } from "@/content/insights";
import type { Insight } from "@/content/insights/types";
import type { MarketStateEdition, NusantaraView, Signal, Theme } from "@/content/model/intelligence";
import { STRATEGIES, type Strategy } from "@/content/strategies";

/**
 * CONTENT SOURCE — where the repository's raw editorial content comes from.
 *
 *   CONTENT_SOURCE=local (default)  the typed files in src/content. No database.
 *   CONTENT_SOURCE=cms              the Admin Portal database (Payload Local API,
 *                                   server-side only; see ./cms-source.ts).
 *
 * Both return exactly the same types, and the repository applies the same
 * publication rules to either, so pages cannot tell them apart. The switch
 * is a configuration change and a redeploy, never a code change.
 */
export type ContentSourceId = "local" | "cms";
export const contentSource: ContentSourceId = process.env.CONTENT_SOURCE === "cms" ? "cms" : "local";

export type RawContent = {
  insights: Insight[];
  views: NusantaraView[];
  marketStateEditions: MarketStateEdition[];
  signals: Signal[];
  themes: Theme[];
  capabilities: Strategy[];
};

export const LOCAL_CONTENT: RawContent = {
  insights: getAllInsights(),
  views: MARKET_VIEWS,
  marketStateEditions: MARKET_STATE_EDITIONS,
  signals: SIGNALS,
  themes: THEMES,
  capabilities: STRATEGIES,
};

export async function loadRawContent(): Promise<RawContent> {
  if (contentSource === "local") return LOCAL_CONTENT;
  // Loaded only in CMS mode, so the local site never touches Payload or a database.
  const { loadCmsContent } = await import("./cms-source");
  return loadCmsContent();
}
