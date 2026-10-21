import "server-only";
import { config } from "@/lib/config";
import { INSTRUMENTS } from "./instruments";
import { httpProvider } from "./providers/http";
import { illustrativeProvider } from "./providers/illustrative";
import type {
  ChartPeriod,
  DataProvenance,
  InstrumentHistory,
  IntelligenceSnapshot,
  MarketDataProvider,
  MarketSnapshot,
  UnavailableInstrument,
} from "./types";

/**
 * The single entry point through which the website obtains market data.
 *
 * Providers (selected by MARKET_DATA_PROVIDER, see src/lib/config.ts):
 *   illustrative — seeded demonstration dataset (prototype default)
 *   http         — approved API / licensed-vendor gateway (providers/http.ts)
 *
 * The service — not the components — guarantees the public rules:
 *   - a failing provider yields an UNAVAILABLE snapshot, never an error page
 *     and never invented fallback numbers;
 *   - values the licence does not permit to be displayed are withheld;
 *   - catalogue instruments with no value are reported as unavailable.
 * Staleness is time-dependent and is checked where values are rendered
 * (src/lib/market/status.ts), on the server and again in the browser.
 */
const registry: Record<string, MarketDataProvider> = {
  illustrative: illustrativeProvider,
  http: httpProvider,
};

export function getProvider(): MarketDataProvider | null {
  return registry[config.marketDataProvider] ?? null;
}

function unavailableProvenance(): DataProvenance {
  return {
    source: getProvider()?.label ?? "Market data provider not configured",
    provider: config.marketDataProvider,
    status: "unavailable",
    asOf: new Date().toISOString(),
  };
}

function unavailableSnapshot(reason: UnavailableInstrument["reason"]): MarketSnapshot {
  return {
    provenance: unavailableProvenance(),
    disclaimer: "Market data is currently unavailable.",
    instruments: [],
    unavailable: INSTRUMENTS.map((instrument) => ({ instrument, reason })),
  };
}

function report(what: string, e: unknown) {
  console.error(`[market-data] ${what} failed (${config.marketDataProvider}):`, e instanceof Error ? e.message : e);
}

/** Applies display licensing and catalogue completeness to a provider snapshot. */
function govern(snap: MarketSnapshot): MarketSnapshot {
  const unavailable = [...(snap.unavailable ?? [])];
  const instruments = snap.instruments.filter((s) => {
    if ((s.provenance.licence ?? "public") === "restricted") {
      unavailable.push({ instrument: s.instrument, reason: "not-licensed" });
      return false;
    }
    if (!Number.isFinite(s.quote.value)) {
      unavailable.push({ instrument: s.instrument, reason: "invalid" });
      return false;
    }
    return true;
  });
  const seen = new Set([...instruments.map((s) => s.instrument.id), ...unavailable.map((u) => u.instrument.id)]);
  for (const instrument of INSTRUMENTS) if (!seen.has(instrument.id)) unavailable.push({ instrument, reason: "not-supplied" });
  const status = instruments.length === 0 ? "unavailable" : snap.provenance.status;
  return { ...snap, provenance: { ...snap.provenance, status }, instruments, unavailable };
}

async function loadSnapshot(): Promise<MarketSnapshot> {
  const provider = getProvider();
  if (!provider) return unavailableSnapshot("not-supplied");
  try {
    return govern(await provider.getSnapshot());
  } catch (e) {
    report("snapshot", e);
    return unavailableSnapshot("service-unavailable");
  }
}

export async function getMarketSnapshot(ids?: string[]): Promise<MarketSnapshot> {
  const snap = await loadSnapshot();
  if (!ids) return snap;
  const order = new Map(ids.map((id, i) => [id, i]));
  const byOrder = <T extends { instrument: { id: string } }>(list: T[]) =>
    list.filter((s) => order.has(s.instrument.id)).sort((a, b) => order.get(a.instrument.id)! - order.get(b.instrument.id)!);
  return { ...snap, instruments: byOrder(snap.instruments), unavailable: byOrder(snap.unavailable) };
}

/** History for displayable instruments only. Missing history is returned as absent, never invented. */
export async function getMarketHistory(period: ChartPeriod, ids?: string[]): Promise<InstrumentHistory[]> {
  const provider = getProvider();
  if (!provider) return [];
  const displayable = new Set((await loadSnapshot()).instruments.map((s) => s.instrument.id));
  const wanted = (ids ?? INSTRUMENTS.map((i) => i.id)).filter((id) => displayable.has(id));
  if (!wanted.length) return [];
  try {
    return (await provider.getHistory(period, ids ? wanted : undefined)).filter((h) => displayable.has(h.instrumentId));
  } catch (e) {
    report(`history ${period}`, e);
    return [];
  }
}

export async function getIntelligence(): Promise<IntelligenceSnapshot> {
  const provider = getProvider();
  const empty: IntelligenceSnapshot = { provenance: unavailableProvenance(), disclaimer: "Structural indicators are currently unavailable.", indicators: [] };
  if (!provider) return empty;
  try {
    const intel = await provider.getIntelligence();
    return { ...intel, indicators: intel.indicators.filter((i) => (i.provenance.licence ?? "public") === "public") };
  } catch (e) {
    report("intelligence", e);
    return empty;
  }
}

export function getRefreshInterval() {
  return getProvider()?.refreshIntervalMs ?? null;
}
