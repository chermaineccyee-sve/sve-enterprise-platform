import "server-only";
import config from "@payload-config";
import { getPayload, type CollectionSlug, type Where } from "payload";
import type { Block, Insight, InsightSource } from "@/content/insights/types";
import type { MarketStateEdition, NusantaraView, Signal, Stance, Theme } from "@/content/model/intelligence";
import type { Publication } from "@/content/model/publication";
import type { Strategy } from "@/content/strategies";
import { config as site } from "@/lib/config";
import type { RawContent } from "./source";

/**
 * CMS loaders (CONTENT_SOURCE=cms). Reads the Admin Portal database through
 * Payload's Local API — on the server only; nothing here reaches the browser
 * — and maps documents to the site's existing content types, so the
 * repository applies exactly the same publication rules as for local files.
 *
 * Which version is read follows the environment's visibility rules
 * (src/lib/config.ts):
 *  - production (published only): the LIVE published version of each item,
 *    and only where its workflow status is Published;
 *  - review / staging (non-public review environments): the latest working
 *    version, which the repository then filters to the statuses that
 *    environment may show (never Draft or Archived).
 *
 * Classification is carried, not inferred: an item counts as sample content
 * (and so can never render in production) unless an Admin has confirmed it
 * as Approved corporate content. Publication state never changes that.
 */

type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const publishedOnly = site.visibleStatuses.length === 1 && site.visibleStatuses[0] === "published";

async function findAll(collection: CollectionSlug): Promise<Doc[]> {
  const payload = await getPayload({ config });
  const where: Where = publishedOnly
    ? { and: [{ _status: { equals: "published" } }, { workflowStatus: { equals: "published" } }] }
    : { workflowStatus: { not_in: ["draft", "archived"] } };
  const res = await payload.find({ collection, where, draft: !publishedOnly, depth: 1, limit: 0, pagination: false, overrideAccess: true });
  return res.docs as Doc[];
}

/* Field helpers ----------------------------------------------------------- */

const iso = (v: unknown): string | null => (typeof v === "string" && v ? new Date(v).toISOString() : null);
const day = (v: unknown): string => (typeof v === "string" && v ? v.slice(0, 10) : "");
const textRows = (rows: unknown): string[] => (Array.isArray(rows) ? rows.map((r: Doc) => String(r?.text ?? "")).filter(Boolean) : []);
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
/** A related document's public id: its slug or key. */
const ref = (v: unknown): string | null => (v && typeof v === "object" ? ((v as Doc).slug ?? (v as Doc).key ?? null) : null);
const refs = (v: unknown): string[] => (Array.isArray(v) ? (v.map(ref).filter(Boolean) as string[]) : []);

function publication(d: Doc): Publication {
  return {
    status: d.workflowStatus,
    sample: d.contentClass !== "approved_corporate",
    author: d.author ?? null,
    approvedBy: d.approvedBy ?? null,
    publishedAt: iso(d.publishedAt),
    updatedAt: iso(d.updatedAt) ?? new Date(0).toISOString(),
    reviewAt: iso(d.reviewAt),
  };
}

function stance(s: Doc | null | undefined): Stance | null {
  const scale = Array.isArray(s?.scale) ? s!.scale.map((x: Doc) => String(x.label)) : [];
  if (scale.length !== 5 || typeof s?.position !== "number") return null;
  return { scale: scale as Stance["scale"], position: s.position as Stance["position"] };
}

/* Mappers ----------------------------------------------------------------- */

function toBlock(b: Doc): Block {
  switch (b.blockType) {
    case "heading":
      return { type: "heading", text: b.text, id: b.anchor };
    case "list":
      return { type: "list", items: textRows(b.items), ordered: !!b.ordered };
    case "layer":
      return { type: "layer", layer: b.layer, title: b.title, body: textRows(b.body) };
    case "table":
      return { type: "table", caption: b.caption, columns: strArr(b.columns), rows: Array.isArray(b.rows) ? b.rows : [], note: b.note ?? undefined, layer: b.layer ?? undefined };
    case "comparison":
      return { type: "comparison", caption: b.caption, left: b.left, right: b.right, rows: Array.isArray(b.rows) ? b.rows : [] };
    case "chart":
      return { type: "chart", caption: b.caption, kind: b.kind, xLabels: strArr(b.xLabels), series: Array.isArray(b.series) ? b.series : [], unit: b.unit ?? undefined, decimals: b.decimals, source: b.source, illustrative: b.illustrative !== false };
    case "scenario":
      return { type: "scenario", scenario: b.scenario };
    case "callout":
      return { type: "callout", title: b.title, text: b.text };
    case "pullquote":
      return { type: "pullquote", text: b.text };
    default:
      return { type: "paragraph", text: b.text ?? "" };
  }
}

function toInsight(d: Doc): Insight {
  return {
    ...publication(d),
    author: d.author ?? "",
    slug: d.slug,
    title: d.title,
    subtitle: d.subtitle,
    category: d.category,
    date: day(d.date),
    summary: d.summary,
    executiveSummary: textRows(d.executiveSummary),
    keyTakeaways: textRows(d.keyTakeaways),
    tags: strArr(d.tags),
    hero: { motif: d.heroMotif ?? "arcs" },
    featured: !!d.featured,
    sources: (Array.isArray(d.sources) ? d.sources : []).map(
      (s: Doc): InsightSource => ({
        label: s.label,
        ...(s.detail ? { detail: s.detail } : {}),
        ...(s.url ? { url: s.url } : {}),
        ...(s.provider ? { provider: s.provider } : {}),
        ...(s.publishedAt ? { publishedAt: day(s.publishedAt) } : {}),
        ...(s.retrievedAt ? { retrievedAt: day(s.retrievedAt) } : {}),
        ...(s.licensingNote ? { licensingNote: s.licensingNote } : {}),
        ...(s.methodology ? { methodology: s.methodology } : {}),
      }),
    ),
    methodology: d.methodology ?? undefined,
    body: (Array.isArray(d.body) ? d.body : []).map(toBlock),
    related: refs(d.related),
    markets: strArr(d.markets),
    themes: refs(d.themes),
    assetClasses: strArr(d.assetClasses) as Insight["assetClasses"],
    capabilities: refs(d.capabilities),
    marketStateDimensions: strArr(d.marketStateDimensions),
    seo: d.seo ? { title: d.seo.title ?? undefined, description: d.seo.description ?? undefined } : undefined,
  };
}

function toView(d: Doc): NusantaraView {
  const k = d.subject?.kind;
  const subject = (k === "instrument" ? { kind: k, id: d.subject.instrument } : k === "assetClass" ? { kind: k, id: d.subject.assetClass } : { kind: "indicator", id: d.subject?.indicator }) as NusantaraView["subject"];
  return {
    ...publication(d),
    id: d.key,
    subject,
    signal: d.signal ?? null,
    stance: stance(d.stance),
    summary: d.summary ?? null,
    context: d.context,
    whatWeAreWatching: textRows(d.whatWeAreWatching),
    keyRisk: d.keyRisk ?? null,
    whatWouldChangeOurView: d.whatWouldChangeOurView ?? null,
    relatedMarkets: strArr(d.relatedMarkets),
    relatedInsight: ref(d.relatedInsight),
    theme: ref(d.theme),
    marketStateDimensions: strArr(d.marketStateDimensions),
  };
}

function toEdition(d: Doc): MarketStateEdition {
  return {
    ...publication(d),
    id: d.key,
    edition: d.edition,
    framing: d.framing?.title ? { title: d.framing.title, note: d.framing.note ?? "" } : null,
    dimensions: (Array.isArray(d.dimensions) ? d.dimensions : []).map((x: Doc) => ({
      id: x.dimension,
      label: x.label,
      state: x.state,
      stance: stance(x.stance)!,
      summary: x.summary,
      watchItems: textRows(x.watchItems),
      changeConditions: x.changeConditions,
      supportingMarkets: strArr(x.supportingMarkets),
      relatedInsight: ref(x.relatedInsight),
      updatedAt: iso(x.dimensionUpdatedAt) ?? iso(d.updatedAt)!,
      status: x.dimensionStatus,
    })),
  };
}

const toSignal = (d: Doc): Signal => ({
  ...publication(d),
  id: d.key,
  date: day(d.date),
  theme: d.theme,
  headline: d.headline,
  reading: d.reading,
  ...(d.instrument ? { instrument: d.instrument } : {}),
  insight: ref(d.insight),
});

const toTheme = (d: Doc): Theme => ({
  ...publication(d),
  id: d.key,
  title: d.title,
  statement: d.statement,
  insights: refs(d.insights),
  instruments: strArr(d.instruments),
  indicators: strArr(d.indicators),
});

function toCapability(d: Doc): Strategy {
  const p = d.profile;
  const lvl = (v: unknown) => Number(v) as 0 | 1 | 2;
  return {
    slug: d.slug,
    name: d.name,
    status: d.capabilityStatus,
    stage: d.stage,
    summary: d.summary,
    overview: d.overview,
    approach: d.approach,
    opportunitySet: textRows(d.opportunitySet),
    riskConsiderations: textRows(d.riskConsiderations),
    timeHorizon: d.timeHorizon ?? null,
    characteristics: textRows(d.characteristics),
    role: d.role,
    profile: p?.liquidity != null ? { liquidity: lvl(p.liquidity), income: lvl(p.income), complexity: lvl(p.complexity), valuationFrequency: lvl(p.valuationFrequency) } : null,
    markets: strArr(d.markets),
    indicators: strArr(d.indicators),
    insights: refs(d.insights),
    // Product details are never CMS content (approved product + data source required).
    product: null,
  };
}

export async function loadCmsContent(): Promise<RawContent> {
  const [insights, views, editions, signals, themes, capabilities] = await Promise.all(
    (["insights", "nusantaraViews", "marketStateEditions", "signals", "themes", "capabilities"] as const).map((c) => findAll(c)),
  );
  return {
    insights: insights.map(toInsight).sort((a, b) => b.date.localeCompare(a.date)),
    views: views.map(toView),
    marketStateEditions: editions.map(toEdition),
    signals: signals.map(toSignal),
    themes: themes.map(toTheme),
    // Capabilities also carry their own lifecycle status, filtered by the repository.
    capabilities: capabilities.map(toCapability),
  };
}
