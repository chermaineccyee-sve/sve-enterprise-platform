/**
 * RELATIONSHIP ENGINE
 *
 * Relationships are declared once, as data, on whichever record owns them:
 *
 *   Nusantara View      → subject market / asset class / indicator, related markets, related insight
 *   Market State dim.   → supporting markets, related insight
 *   Insight             → markets, themes, capabilities, Market State dimensions, related research
 *   Theme               → insights, markets, indicators
 *   Capability          → markets, indicators, insights, risks
 *
 * buildContentGraph() joins them into one bidirectional graph, so a link
 * declared on either side is visible from both. Components never hard-code
 * relationships: pages ask the graph and pass the answers down as props.
 *
 * Built from VISIBLE content only — a link to something unpublished, expired
 * or archived simply disappears (and the UI shows its "no related research"
 * state) rather than pointing at a missing page.
 */
import type { MarketStateEdition, NusantaraView, Theme } from "@/content/model/intelligence";
import type { Insight } from "@/content/insights/types";
import type { Strategy } from "@/content/strategies";
import type { InstrumentDefinition } from "@/lib/market/types";

export type GraphInput = {
  instruments: InstrumentDefinition[];
  views: NusantaraView[];
  marketState: MarketStateEdition | null;
  insights: Insight[];
  themes: Theme[];
  capabilities: Strategy[];
};

type Edges = Map<string, Set<string>>;

function add(map: Edges, from: string, to: string) {
  let set = map.get(from);
  if (!set) map.set(from, (set = new Set()));
  set.add(to);
}
/** Records a relationship in both directions. */
function link(forward: Edges, backward: Edges, a: string, b: string) {
  add(forward, a, b);
  add(backward, b, a);
}
const list = (map: Edges, key: string) => [...(map.get(key) ?? [])];

export function buildContentGraph(input: GraphInput) {
  const { instruments, views, marketState, insights, themes, capabilities } = input;
  const insightSlugs = new Set(insights.map((i) => i.slug));
  const instrumentIds = new Set(instruments.map((i) => i.id));
  const assetClassOf = new Map(instruments.map((i) => [i.id, i.assetClass]));
  const keepInsight = (s: string | null | undefined): s is string => !!s && insightSlugs.has(s);

  // Views by subject.
  const instrumentView = new Map<string, NusantaraView>();
  const classView = new Map<string, NusantaraView>();
  const indicatorView = new Map<string, NusantaraView>();
  for (const v of views) {
    if (v.subject.kind === "instrument") instrumentView.set(v.subject.id, v);
    else if (v.subject.kind === "assetClass") classView.set(v.subject.id, v);
    else indicatorView.set(v.subject.id, v);
  }
  const viewForMarket = (id: string): NusantaraView | null => {
    const cls = assetClassOf.get(id);
    return instrumentView.get(id) ?? (cls ? classView.get(cls) : undefined) ?? null;
  };

  // Market ↔ insight / dimension / capability, and insight ↔ theme / capability / dimension.
  const marketInsights: Edges = new Map();
  const insightMarkets: Edges = new Map();
  const marketDims: Edges = new Map();
  const insightDims: Edges = new Map();
  const dimInsights: Edges = new Map();
  const marketCaps: Edges = new Map();
  const insightCaps: Edges = new Map();
  const capInsights: Edges = new Map();
  const insightThemes: Edges = new Map();
  const themeInsights: Edges = new Map();

  for (const i of insights) {
    for (const m of i.markets ?? []) if (instrumentIds.has(m)) link(insightMarkets, marketInsights, i.slug, m);
    for (const t of i.themes ?? []) link(insightThemes, themeInsights, i.slug, t);
    for (const c of i.capabilities ?? []) link(insightCaps, capInsights, i.slug, c);
    for (const d of i.marketStateDimensions ?? []) link(insightDims, dimInsights, i.slug, d);
  }
  for (const v of views) {
    if (v.subject.kind === "instrument" && keepInsight(v.relatedInsight)) add(marketInsights, v.subject.id, v.relatedInsight);
  }
  for (const d of marketState?.dimensions ?? []) {
    for (const m of d.supportingMarkets) add(marketDims, m, d.id);
    if (keepInsight(d.relatedInsight)) link(dimInsights, insightDims, d.id, d.relatedInsight);
  }
  for (const t of themes) for (const s of t.insights) if (keepInsight(s)) link(themeInsights, insightThemes, t.id, s);
  for (const c of capabilities) {
    for (const m of c.markets) add(marketCaps, m, c.slug);
    for (const s of c.insights) if (keepInsight(s)) link(capInsights, insightCaps, c.slug, s);
  }
  // Automatic linking: an insight that discusses a capability's markets relates to that capability.
  for (const i of insights)
    for (const m of i.markets ?? []) for (const c of list(marketCaps, m)) link(insightCaps, capInsights, i.slug, c);

  const bySlug = new Map(insights.map((i) => [i.slug, i]));
  const byDate = [...insights].sort((a, b) => b.date.localeCompare(a.date));

  return {
    /** The view that applies to an instrument: its own, else its asset class's. */
    viewForMarket,
    viewForIndicator: (id: string) => indicatorView.get(id) ?? null,
    viewForAssetClass: (id: string) => classView.get(id) ?? null,

    /** Markets related to a market, as declared by its view (self excluded). */
    relatedMarkets(id: string, limit = 4): string[] {
      return (viewForMarket(id)?.relatedMarkets ?? []).filter((m) => m !== id && instrumentIds.has(m)).slice(0, limit);
    },
    /** The single most relevant insight for a market: the view's choice, else the newest that discusses it. */
    insightForMarket(id: string): string | null {
      const v = viewForMarket(id);
      if (v && keepInsight(v.relatedInsight)) return v.relatedInsight;
      return byDate.find((i) => marketInsights.get(id)?.has(i.slug))?.slug ?? null;
    },
    insightsForMarket: (id: string) => byDate.filter((i) => marketInsights.get(id)?.has(i.slug)).map((i) => i.slug),
    dimensionsForMarket: (id: string) => list(marketDims, id),
    capabilitiesForMarket: (id: string) => list(marketCaps, id),

    marketsForInsight: (slug: string) => list(insightMarkets, slug),
    themesForInsight: (slug: string) => list(insightThemes, slug),
    capabilitiesForInsight: (slug: string) => list(insightCaps, slug),
    dimensionsForInsight: (slug: string) => list(insightDims, slug),
    insightsForTheme: (id: string) => list(themeInsights, id),
    insightsForDimension: (id: string) => list(dimInsights, id),
    insightsForCapability(slug: string): string[] {
      const declared = capabilities.find((c) => c.slug === slug)?.insights.filter(keepInsight) ?? [];
      return [...new Set([...declared, ...list(capInsights, slug)])];
    },
    marketsForCapability: (slug: string) => capabilities.find((c) => c.slug === slug)?.markets.filter((m) => instrumentIds.has(m)) ?? [],
    risksForCapability: (slug: string) => capabilities.find((c) => c.slug === slug)?.riskConsiderations ?? [],

    /** Related research for an article: curated first, then same category, then newest. Never empty while other research exists. */
    relatedInsights(slug: string, limit = 3): Insight[] {
      const self = bySlug.get(slug);
      if (!self) return [];
      const explicit = (self.related ?? []).map((s) => bySlug.get(s)).filter((i): i is Insight => !!i && i.slug !== slug);
      const fallback = byDate.filter((i) => i.slug !== slug && !explicit.includes(i) && i.category === self.category);
      const rest = byDate.filter((i) => i.slug !== slug && !explicit.includes(i) && !fallback.includes(i));
      return [...explicit, ...fallback, ...rest].slice(0, limit);
    },
  };
}

export type ContentGraph = ReturnType<typeof buildContentGraph>;
