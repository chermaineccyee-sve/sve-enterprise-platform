import "server-only";
import { INSTRUMENTS } from "../instruments";
import type {
  ChartPeriod,
  DataProvenance,
  DataStatus,
  InstrumentHistory,
  InstrumentSnapshot,
  IntelligenceIndicator,
  MarketDataProvider,
  MarketSnapshot,
  UnavailableInstrument,
} from "../types";

/**
 * APPROVED API PROVIDER — adapter for an authorised market-data API that
 * returns Nusantara's normalised contract (below). A licensed enterprise
 * vendor is integrated the same way: either its gateway returns this
 * contract, or a sibling adapter maps the vendor SDK into the same types.
 *
 * Server-only. Credentials are read from server environment variables and
 * never reach the browser; the website's own /api/market routes are the
 * only thing the client calls.
 *
 *   MARKET_DATA_PROVIDER=http
 *   MARKET_DATA_API_URL=https://…        (no trailing slash)
 *   MARKET_DATA_API_KEY=…                (sent as a Bearer token)
 *   MARKET_DATA_SOURCE_NAME="Vendor name" (shown in source lines)
 *
 * Contract
 *   GET /snapshot  → { asOf, status: "delayed"|"live", delayMinutes?, staleAfterMinutes?,
 *                      attribution?, licensingNote?, quotes: [{ id, value, previousClose, asOf?, licence? }] }
 *   GET /history?period=1M&ids=klci,sti → { series: [{ id, points: [{ t, v }] }] }
 *   GET /indicators → { asOf, indicators: IntelligenceIndicator-like[] }   (optional)
 *
 * Ids are Nusantara instrument ids (src/lib/market/instruments.ts); the
 * gateway owns the mapping to vendor symbols.
 */

const TIMEOUT_MS = 8000;
/** Seconds the website may reuse a response before asking again. */
const REVALIDATE_S = 60;

type SnapshotPayload = {
  asOf: string;
  status: Extract<DataStatus, "delayed" | "live">;
  delayMinutes?: number;
  staleAfterMinutes?: number;
  attribution?: string;
  licensingNote?: string;
  quotes: { id: string; value: number; previousClose: number; asOf?: string; licence?: "public" | "restricted" }[];
};

function settings() {
  const url = process.env.MARKET_DATA_API_URL;
  const key = process.env.MARKET_DATA_API_KEY;
  if (!url || !key) throw new Error("Market-data API is not configured (MARKET_DATA_API_URL / MARKET_DATA_API_KEY).");
  return { url, key, source: process.env.MARKET_DATA_SOURCE_NAME ?? "Market data provider" };
}

async function get<T>(path: string): Promise<T> {
  const { url, key } = settings();
  const res = await fetch(`${url}${path}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: { revalidate: REVALIDATE_S },
  });
  if (!res.ok) throw new Error(`Market-data API ${path} responded ${res.status}`);
  return (await res.json()) as T;
}

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

export const httpProvider: MarketDataProvider = {
  id: "http",
  get label() {
    return process.env.MARKET_DATA_SOURCE_NAME ?? "Market data provider";
  },
  refreshIntervalMs: 60_000,

  async getSnapshot(): Promise<MarketSnapshot> {
    const { source } = settings();
    const p = await get<SnapshotPayload>("/snapshot");
    const status: DataStatus = p.status === "live" ? "live" : "delayed";
    const base: DataProvenance = {
      source,
      provider: "http",
      status,
      asOf: p.asOf,
      retrievedAt: new Date().toISOString(),
      delayMinutes: p.delayMinutes,
      staleAfterMinutes: p.staleAfterMinutes,
      attribution: p.attribution,
      licence: "public",
      licensingNote: p.licensingNote,
    };
    const quotes = new Map(p.quotes.map((q) => [q.id, q]));
    const instruments: InstrumentSnapshot[] = [];
    const unavailable: UnavailableInstrument[] = [];
    for (const instrument of INSTRUMENTS) {
      const q = quotes.get(instrument.id);
      if (!q) {
        unavailable.push({ instrument, reason: "not-supplied" });
        continue;
      }
      if (!finite(q.value) || !finite(q.previousClose) || q.previousClose === 0) {
        unavailable.push({ instrument, reason: "invalid" });
        continue;
      }
      const change = q.value - q.previousClose;
      const isYield = instrument.convention === "yield";
      instruments.push({
        instrument,
        quote: {
          value: q.value,
          previousClose: q.previousClose,
          change,
          changePct: isYield ? null : (change / q.previousClose) * 100,
          changeBp: isYield ? change * 100 : null,
        },
        provenance: { ...base, asOf: q.asOf ?? p.asOf, licence: q.licence ?? "public" },
      });
    }
    return {
      provenance: base,
      disclaimer: p.attribution ?? `Market data from ${source}. ${status === "delayed" ? "Delayed" : "Live"} data, for information only.`,
      instruments,
      unavailable,
    };
  },

  async getHistory(period: ChartPeriod, instrumentIds?: string[]): Promise<InstrumentHistory[]> {
    const ids = instrumentIds ?? INSTRUMENTS.map((i) => i.id);
    const p = await get<{ series: { id: string; points: { t: string; v: number }[] }[] }>(
      `/history?period=${encodeURIComponent(period)}&ids=${ids.map(encodeURIComponent).join(",")}`,
    );
    return p.series
      .filter((s) => ids.includes(s.id))
      .map((s) => ({ instrumentId: s.id, period, points: s.points.filter((pt) => finite(pt.v) && !Number.isNaN(Date.parse(pt.t))) }));
  },

  async getIntelligence() {
    const { source } = settings();
    const p = await get<{ asOf: string; disclaimer?: string; indicators: IntelligenceIndicator[] }>("/indicators");
    return {
      provenance: { source, provider: "http", status: "delayed" as const, asOf: p.asOf, licence: "public" as const },
      disclaimer: p.disclaimer ?? `Structural indicators from ${source}.`,
      indicators: p.indicators,
    };
  },
};
