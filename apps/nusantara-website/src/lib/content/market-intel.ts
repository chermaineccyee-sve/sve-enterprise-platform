import "server-only";
import type { MarketIntel } from "@/content/model/market-intel";
import { getCapabilities, getContentGraph, getInsightListings, getMarketState } from "./repository";

/**
 * Resolves, for each instrument, the chain shown beside its market data:
 * Nusantara View, related markets, related insight, Market State dimensions
 * and capabilities. Used by every interactive market surface, so the
 * homepage, dashboard and any future surface agree on the relationships.
 * Only visible content is returned; anything missing simply drops out.
 */
export async function getMarketIntel(ids: string[]): Promise<Record<string, MarketIntel>> {
  const [graph, listings, marketState, capabilities] = await Promise.all([getContentGraph(), getInsightListings(), getMarketState(), getCapabilities()]);
  const listingBySlug = new Map(listings.map((l) => [l.slug, l]));
  const dimById = new Map((marketState?.dimensions ?? []).map((d) => [d.id, d]));
  const capBySlug = new Map(capabilities.map((c) => [c.slug, c]));
  return Object.fromEntries(
    ids.map((id) => {
      const slug = graph.insightForMarket(id);
      return [
        id,
        {
          view: graph.viewForMarket(id),
          relatedMarkets: graph.relatedMarkets(id),
          insight: slug ? (listingBySlug.get(slug) ?? null) : null,
          dimensions: graph
            .dimensionsForMarket(id)
            .map((d) => dimById.get(d))
            .filter((d) => !!d)
            .slice(0, 2)
            .map((d) => ({ id: d!.id, label: d!.label, state: d!.state })),
          capabilities: graph
            .capabilitiesForMarket(id)
            .map((c) => capBySlug.get(c))
            .filter((c) => !!c)
            .slice(0, 2)
            .map((c) => ({ slug: c!.slug, name: c!.name })),
        } satisfies MarketIntel,
      ];
    }),
  );
}
