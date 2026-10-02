import "server-only";
import { illustrativeProvider } from "./providers/illustrative";
import type { ChartPeriod, MarketDataProvider } from "./types";

/**
 * The single entry point through which the website obtains market data.
 *
 * To integrate an authorised source, implement `MarketDataProvider` in
 * `providers/<name>.ts`, add it to the registry and set
 * MARKET_DATA_PROVIDER=<name>. Status, source and disclaimer wording flow
 * from the provider into every component automatically.
 */
const registry: Record<string, MarketDataProvider> = {
  illustrative: illustrativeProvider,
};

export function getProvider(): MarketDataProvider {
  const id = process.env.MARKET_DATA_PROVIDER ?? "illustrative";
  return registry[id] ?? illustrativeProvider;
}

export async function getMarketSnapshot(ids?: string[]) {
  const snap = await getProvider().getSnapshot();
  if (!ids) return snap;
  const order = new Map(ids.map((id, i) => [id, i]));
  return {
    ...snap,
    instruments: snap.instruments
      .filter((s) => order.has(s.instrument.id))
      .sort((a, b) => order.get(a.instrument.id)! - order.get(b.instrument.id)!),
  };
}

export async function getMarketHistory(period: ChartPeriod, ids?: string[]) {
  return getProvider().getHistory(period, ids);
}

export async function getIntelligence() {
  return getProvider().getIntelligence();
}

export function getRefreshInterval() {
  return getProvider().refreshIntervalMs;
}
