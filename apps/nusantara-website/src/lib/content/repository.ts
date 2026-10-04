import "server-only";
import { cache } from "react";
import { MONITORED_MARKETS } from "@/content/data/markets";
import { readingMinutes, toListing } from "@/content/insights";
import type { Insight, InsightListing } from "@/content/insights/types";
import type { MarketStateEdition, NusantaraView, Signal, Theme } from "@/content/model/intelligence";
import { isVisible, publicationProblems, type Publication } from "@/content/model/publication";
import { capabilityProblems, type CapabilityStatus, type Strategy } from "@/content/strategies";
import { config } from "@/lib/config";
import { INSTRUMENTS } from "@/lib/market/instruments";
import { buildContentGraph } from "./relationships";
import { LOCAL_CONTENT, loadRawContent, type RawContent } from "./source";

/**
 * CONTENT REPOSITORY — the only way pages obtain editorial content.
 *
 * The raw content comes from the configured source (./source.ts): the typed
 * files in src/content (CONTENT_SOURCE=local, the default) or the Admin
 * Portal (CONTENT_SOURCE=cms). Only the loader differs: every function
 * returns the same types, and every publication rule is applied here rather
 * than in components. See docs/ARCHITECTURE.md.
 *
 * Rules applied:
 *  - only publication states allowed by the environment are returned;
 *  - sample content appears only in the management-review environment;
 *  - time-sensitive items past their review date are withdrawn;
 *  - capabilities appear only in an approved lifecycle state;
 *  - integrity problems (dangling references, published items without
 *    approval, active products without product details) fail the build.
 */

const rules = { visibleStatuses: config.visibleStatuses, allowSampleContent: config.allowSampleContent };
const visible = <T extends Publication | Omit<Publication, "author">>(items: T[]) => items.filter((i) => isVisible(i as Publication, rules));

const CAPABILITY_VISIBLE: Record<typeof config.environment, CapabilityStatus[]> = {
  review: ["review", "public-capability", "active-product"],
  staging: ["public-capability", "active-product"],
  production: ["public-capability", "active-product"],
};

/* ------------------------------------------------------------------ */
/* Integrity                                                           */
/* ------------------------------------------------------------------ */

export function contentProblems(raw: RawContent = LOCAL_CONTENT): string[] {
  const out: string[] = [];
  const { insights, views: MARKET_VIEWS, marketStateEditions: MARKET_STATE_EDITIONS, signals: SIGNALS, themes: THEMES, capabilities: STRATEGIES } = raw;
  const slugs = new Set(insights.map((i) => i.slug));
  const instruments = new Set(INSTRUMENTS.map((i) => i.id));
  const caps = new Set(STRATEGIES.map((s) => s.slug));
  const themes = new Set(THEMES.map((t) => t.id));
  const dims = new Set(MARKET_STATE_EDITIONS.flatMap((e) => e.dimensions.map((d) => d.id)));
  const ref = (owner: string, kind: string, set: Set<string>, ids: (string | null | undefined)[]) => {
    for (const id of ids) if (id && !set.has(id)) out.push(`${owner}: unknown ${kind} "${id}"`);
  };

  for (const i of insights) {
    out.push(...publicationProblems(`insight ${i.slug}`, { ...i, author: i.author }, { timeSensitive: false }));
    ref(`insight ${i.slug}`, "insight", slugs, i.related ?? []);
    ref(`insight ${i.slug}`, "instrument", instruments, i.markets ?? []);
    ref(`insight ${i.slug}`, "theme", themes, i.themes ?? []);
    ref(`insight ${i.slug}`, "capability", caps, i.capabilities ?? []);
    ref(`insight ${i.slug}`, "dimension", dims, i.marketStateDimensions ?? []);
  }
  for (const v of MARKET_VIEWS) {
    out.push(...publicationProblems(`view ${v.id}`, v, { timeSensitive: true }));
    if (v.subject.kind === "instrument") ref(`view ${v.id}`, "instrument", instruments, [v.subject.id]);
    ref(`view ${v.id}`, "instrument", instruments, v.relatedMarkets);
    ref(`view ${v.id}`, "insight", slugs, [v.relatedInsight]);
    ref(`view ${v.id}`, "dimension", dims, v.marketStateDimensions ?? []);
  }
  for (const e of MARKET_STATE_EDITIONS) {
    out.push(...publicationProblems(`market state ${e.id}`, e, { timeSensitive: true }));
    for (const d of e.dimensions) {
      ref(`market state ${e.id}/${d.id}`, "instrument", instruments, d.supportingMarkets);
      ref(`market state ${e.id}/${d.id}`, "insight", slugs, [d.relatedInsight]);
    }
  }
  for (const s of SIGNALS) {
    out.push(...publicationProblems(`signal ${s.id}`, s, { timeSensitive: true }));
    ref(`signal ${s.id}`, "instrument", instruments, [s.instrument]);
    ref(`signal ${s.id}`, "insight", slugs, [s.insight]);
  }
  for (const t of THEMES) {
    out.push(...publicationProblems(`theme ${t.id}`, t, { timeSensitive: false }));
    ref(`theme ${t.id}`, "insight", slugs, t.insights);
    ref(`theme ${t.id}`, "instrument", instruments, t.instruments);
  }
  for (const s of STRATEGIES) {
    out.push(...capabilityProblems(s));
    ref(`capability ${s.slug}`, "instrument", instruments, s.markets);
    ref(`capability ${s.slug}`, "insight", slugs, s.insights);
  }
  for (const m of MONITORED_MARKETS) {
    ref(`market ${m.id}`, "instrument", instruments, [m.index, m.currency, m.rate]);
    ref(`market ${m.id}`, "insight", slugs, [m.insight]);
  }
  return out;
}

/** Raw content from the configured source, integrity-checked once per request/build. */
const content = cache(async (): Promise<RawContent> => {
  const raw = await loadRawContent();
  const problems = contentProblems(raw);
  if (problems.length) throw new Error(`Content integrity check failed:\n  - ${problems.join("\n  - ")}`);
  return raw;
});

/* ------------------------------------------------------------------ */
/* Research                                                            */
/* ------------------------------------------------------------------ */

export const getInsights = cache(async (): Promise<Insight[]> => {
  return visible((await content()).insights);
});

export async function getInsight(slug: string): Promise<Insight | undefined> {
  return (await getInsights()).find((i) => i.slug === slug);
}

export async function getInsightListings(): Promise<InsightListing[]> {
  return (await getInsights()).map(toListing);
}

export async function getFeaturedInsight(): Promise<Insight | null> {
  const all = await getInsights();
  return all.find((i) => i.featured) ?? all[0] ?? null;
}

export { readingMinutes };

/* ------------------------------------------------------------------ */
/* Nusantara interpretation                                            */
/* ------------------------------------------------------------------ */

export const getMarketViews = cache(async (): Promise<NusantaraView[]> => {
  return visible((await content()).views);
});

/** The latest visible Market State edition, with only its visible dimensions. Null when none may be shown. */
export const getMarketState = cache(async (): Promise<MarketStateEdition | null> => {
  const edition = visible((await content()).marketStateEditions).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (!edition) return null;
  const dimensions = edition.dimensions.filter((d) => rules.visibleStatuses.includes(d.status));
  return dimensions.length ? { ...edition, dimensions } : null;
});

export async function getSignals(): Promise<Signal[]> {
  return visible((await content()).signals).sort((a, b) => b.date.localeCompare(a.date));
}

export async function getThemes(): Promise<Theme[]> {
  return visible((await content()).themes);
}

export async function getMonitoredMarkets() {
  return MONITORED_MARKETS;
}

/* ------------------------------------------------------------------ */
/* Capabilities                                                        */
/* ------------------------------------------------------------------ */

export const getCapabilities = cache(async (): Promise<Strategy[]> => {
  return (await content()).capabilities.filter((s) => CAPABILITY_VISIBLE[config.environment].includes(s.status));
});

export async function getCapability(slug: string): Promise<Strategy | undefined> {
  return (await getCapabilities()).find((s) => s.slug === slug);
}

/* ------------------------------------------------------------------ */
/* Relationships                                                       */
/* ------------------------------------------------------------------ */

/** The relationship graph over visible content only. */
export const getContentGraph = cache(async () => {
  const [views, marketState, insights, themes, capabilities] = await Promise.all([
    getMarketViews(),
    getMarketState(),
    getInsights(),
    getThemes(),
    getCapabilities(),
  ]);
  return buildContentGraph({ instruments: INSTRUMENTS, views, marketState, insights, themes, capabilities });
});
