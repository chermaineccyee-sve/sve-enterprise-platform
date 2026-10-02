/**
 * Data-status vocabulary and freshness rules. Client-safe: used by the
 * server when rendering and again in the browser, so a statically rendered
 * page that has aged can never present stale data as current.
 */
import type { DataProvenance, DataStatus } from "./types";

export const STATUS_LABEL: Record<DataStatus, string> = {
  live: "Live",
  delayed: "Delayed",
  illustrative: "Illustrative",
  unavailable: "Unavailable",
};

/** Public definitions, shown in the dashboard methodology. */
export const STATUS_DEFINITION: Record<DataStatus, string> = {
  live: "Streamed from an authorised source during market hours, subject to the provider’s terms.",
  delayed: "From an authorised provider and shown with a stated delay, including end-of-day closing values.",
  illustrative: "Generated for demonstration. Not market data and not to be relied upon.",
  unavailable: "No value is shown — the source is unavailable, not yet approved or not licensed for public display.",
};

/** Default staleness thresholds, used when a provider does not set its own. */
const DEFAULT_STALE_AFTER: Partial<Record<DataStatus, number>> = {
  live: 15,
  delayed: 24 * 60,
};

/**
 * True when a delayed or live value is older than its staleness threshold.
 * Illustrative data is never "current", so it is never stale.
 */
export function isStale(p: Pick<DataProvenance, "status" | "asOf" | "staleAfterMinutes">, now: number = Date.now()): boolean {
  const limit = p.staleAfterMinutes ?? DEFAULT_STALE_AFTER[p.status];
  if (!limit) return false;
  const t = Date.parse(p.asOf);
  if (Number.isNaN(t)) return true;
  return now - t > limit * 60_000;
}

/** Lower-case status phrase for running text, e.g. "illustrative", "delayed 15 min". */
export function statusPhrase(p: Pick<DataProvenance, "status" | "delayMinutes">): string {
  if (p.status === "delayed" && p.delayMinutes) return `delayed ${p.delayMinutes} min`;
  return STATUS_LABEL[p.status].toLowerCase();
}

/** Capitalised status phrase, e.g. "Illustrative", "Delayed 15 min". */
export function statusTitle(p: Pick<DataProvenance, "status" | "delayMinutes">): string {
  const s = statusPhrase(p);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
