"use client";

import { useEffect, useState } from "react";
import type { ChartPeriod, InstrumentHistory, MarketSnapshot } from "@/lib/market/types";

const historyCache = new Map<ChartPeriod, Promise<InstrumentHistory[]>>();

export function fetchHistory(period: ChartPeriod) {
  let p = historyCache.get(period);
  if (!p) {
    p = fetch(`/api/market/history/${period}`).then((r) => {
      if (!r.ok) throw new Error(`History request failed (${r.status})`);
      return r.json() as Promise<InstrumentHistory[]>;
    });
    p.catch(() => historyCache.delete(period));
    historyCache.set(period, p);
  }
  return p;
}

/**
 * Chart history for a period. The initial period is rendered on the server
 * and passed in; other periods are fetched from the market API on demand.
 */
export function useMarketHistory(period: ChartPeriod, initial: { period: ChartPeriod; data: InstrumentHistory[] }) {
  const [state, setState] = useState<{ period: ChartPeriod; data: InstrumentHistory[]; error: string | null }>({
    ...initial,
    error: null,
  });

  useEffect(() => {
    if (period === state.period && !state.error) return;
    if (period === initial.period) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore server-rendered data synchronously
      setState({ ...initial, error: null });
      return;
    }
    let cancelled = false;
    fetchHistory(period)
      .then((data) => !cancelled && setState({ period, data, error: null }))
      .catch((e: Error) => !cancelled && setState((s) => ({ ...s, error: e.message })));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const loading = state.period !== period && !state.error;
  const byId = new Map(state.data.map((h) => [h.instrumentId, h.points]));
  return { byId, loading, error: state.error, period: state.period };
}

/**
 * Market snapshot with optional polling. Polling is only enabled when the
 * provider declares a refresh interval (never for illustrative data).
 */
export function useMarketSnapshot(initial: MarketSnapshot, refreshIntervalMs: number | null) {
  const [snapshot, setSnapshot] = useState(initial);
  useEffect(() => {
    if (!refreshIntervalMs) return;
    const id = window.setInterval(async () => {
      try {
        const r = await fetch("/api/market/snapshot", { cache: "no-store" });
        if (r.ok) setSnapshot(await r.json());
      } catch {
        /* keep last good snapshot */
      }
    }, refreshIntervalMs);
    return () => window.clearInterval(id);
  }, [refreshIntervalMs]);
  return snapshot;
}

/** Loads several periods (each a cached static file) once `enabled` becomes true. */
export function useHistories(periods: readonly ChartPeriod[], enabled: boolean) {
  const [data, setData] = useState<Partial<Record<ChartPeriod, Map<string, InstrumentHistory["points"]>>>>({});
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    Promise.all(periods.map((p) => fetchHistory(p).then((h) => [p, new Map(h.map((x) => [x.instrumentId, x.points]))] as const)))
      .then((entries) => !cancelled && setData(Object.fromEntries(entries)))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled, periods]);
  return data;
}
