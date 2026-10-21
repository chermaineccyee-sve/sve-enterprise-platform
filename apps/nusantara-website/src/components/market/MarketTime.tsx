"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useClock } from "@/hooks/useClock";
import { formatTimestamp, formatSnapshot } from "@/lib/market/format";
import { formatMyt, formatSnapshotMyt, illustrativeShiftMs, illustrativeSnapshotMs } from "@/lib/market/illustrative-time";
import type { DataProvenance } from "@/lib/market/types";

/**
 * How market timestamps are presented. Illustrative data uses the shared
 * snapshot rule (09:00 MYT on today's Malaysia date, all labels shifted by
 * one offset — see lib/market/illustrative-time). Provider data is shown as
 * supplied.
 *
 * Hydration-safe: the server render and hydration use the time the page was
 * rendered (passed from the root layout); the browser then takes over on a
 * minute clock, so the date rolls forward at Malaysian midnight without a
 * redeploy.
 */
const RenderedAt = createContext<number>(0);

export function MarketTimeProvider({ renderedAt, children }: { renderedAt: number; children: ReactNode }) {
  return <RenderedAt.Provider value={renderedAt}>{children}</RenderedAt.Provider>;
}

export function useMarketTime(status: DataProvenance["status"] | undefined) {
  const renderedAt = useContext(RenderedAt);
  const now = useClock("minute") ?? renderedAt;
  const illustrative = status === "illustrative";
  const shift = illustrative ? illustrativeShiftMs(now) : 0;
  /** Label for a data timestamp (chart axis, tooltip). */
  const stamp = useCallback(
    (iso: string, opts: { time?: boolean } = { time: true }) => (illustrative ? formatMyt(Date.parse(iso) + shift, opts) : formatTimestamp(iso, opts)),
    [illustrative, shift],
  );
  /** The snapshot stamp, e.g. "03 OCT 2026 · 09:00 MYT / SGT" (illustrative) or the provider's own time. */
  const snapshot = useCallback((asOf: string) => (illustrative ? formatSnapshotMyt(illustrativeSnapshotMs(now)) : formatSnapshot(asOf)), [illustrative, now]);
  /** Machine-readable form of what is displayed. */
  const iso = useCallback((asOf: string) => (illustrative ? new Date(illustrativeSnapshotMs(now)).toISOString() : asOf), [illustrative, now]);
  return { illustrative, stamp, snapshot, iso };
}

/** Inline snapshot stamp for server-rendered pages. */
export function SnapshotStamp({ provenance, className = "" }: { provenance: DataProvenance; className?: string }) {
  const t = useMarketTime(provenance.status);
  return (
    <time dateTime={t.iso(provenance.asOf)} className={className}>
      {t.snapshot(provenance.asOf)}
    </time>
  );
}
