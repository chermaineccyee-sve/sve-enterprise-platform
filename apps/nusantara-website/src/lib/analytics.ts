/**
 * ANALYTICS READINESS — event hooks only. No tracker is installed.
 *
 * Components call `track()` at meaningful moments. Each call is dispatched as
 * a DOM event (`nusantara:analytics`) and does nothing else. When management
 * approves an analytics service (docs/MANAGEMENT_DECISIONS.md), a single
 * adapter subscribes to that event — loaded only with consent where required —
 * and forwards events. No component changes are needed.
 *
 *   window.addEventListener("nusantara:analytics", (e) => send(e.detail));
 *
 * Events carry identifiers (instrument ids, slugs, periods), never personal
 * data or form contents.
 */

export type AnalyticsEvent =
  | { name: "market_selected"; instrument: string; surface: "rail" | "select" | "ribbon" | "related" | "table" | "link" }
  | { name: "period_changed"; period: string }
  | { name: "nusantara_view_expanded"; instrument: string }
  | { name: "insight_opened"; slug: string }
  | { name: "insight_source_expanded"; slug: string; source: number }
  | { name: "capability_explored"; capability: string }
  | { name: "contact_started"; topic: string | null }
  | { name: "contact_submitted"; topic: string; delivery: string };

export const ANALYTICS_EVENT = "nusantara:analytics";

export function track(event: AnalyticsEvent): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(ANALYTICS_EVENT, { detail: { ...event, at: new Date().toISOString() } }));
  } catch {
    /* analytics must never affect the page */
  }
}
