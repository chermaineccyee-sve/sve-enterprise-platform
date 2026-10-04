import "server-only";
import config from "@payload-config";
import { unstable_cache } from "next/cache";
import { getPayload } from "payload";
import type { Block, Insight, InsightSource } from "@/content/insights/types";
import type { MarketStateEdition, NusantaraView, Signal, Stance, Theme } from "@/content/model/intelligence";
import type { Publication } from "@/content/model/publication";
import type { Strategy } from "@/content/strategies";
import { contentTag } from "@/cms/hooks/revalidate";
import type { PreviewTarget } from "./preview-session";
import type { ContentKind, RawContent } from "./source";

/**
 * CMS loaders (CONTENT_SOURCE=cms). Reads the Admin Portal database through
 * Payload's Local API — on the server only — and maps documents to the site's
 * existing content types, so the repository applies exactly the same rules
 * and the same relationship graph as for the local files.
 *
 * PUBLIC READS ARE LIVE VERSIONS ONLY. Each collection is read as its live
 * (published) version and cached under its own tag (cms:<collection>), which
 * the Admin Portal revalidates when the live version changes
 * (src/cms/hooks/revalidate.ts). Draft working copies, submissions and
 * approvals never reach a public page or API.
 *
 * The environment then decides what may render, from each item's workflow
 * status and classification (src/lib/config.ts): the management-review site
 * shows live items whose status is In review / Approved / Published;
 * production shows Published only, and never sample content. Anything not
 * confirmed by an Admin as Approved corporate content counts as sample.
 *
 * PREVIEW: in Draft Mode, for a signed-in Admin Portal user (verified on every
 * request — src/lib/content/preview-session.ts), the single item being
 * previewed is replaced by its latest working copy. Nothing is cached.
 *
 * Relationships are stored as ids and resolved here to the slugs/keys the
 * site uses. A link to an item that is not live resolves to nothing, so it
 * disappears exactly as an unpublished link does today.
 */

type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const CMS_COLLECTIONS = ["insights", "nusantaraViews", "marketStateEditions", "signals", "themes", "capabilities"] as const;
type CmsCollection = (typeof CMS_COLLECTIONS)[number];
const KIND: Record<CmsCollection, ContentKind> = {
  insights: "insights",
  nusantaraViews: "views",
  marketStateEditions: "marketStateEditions",
  signals: "signals",
  themes: "themes",
  capabilities: "capabilities",
};

async function readLive(collection: CmsCollection): Promise<Doc[]> {
  const payload = await getPayload({ config });
  const res = await payload.find({
    collection,
    where: { _status: { equals: "published" } },
    draft: false,
    depth: 0,
    limit: 0,
    pagination: false,
    sort: ["displayOrder", "createdAt"],
    overrideAccess: true,
  });
  return res.docs as Doc[];
}

/** Live documents of one collection, cached until that collection's live content changes. */
const liveDocs = (collection: CmsCollection) => unstable_cache(() => readLive(collection), ["cms-live", collection], { tags: [contentTag(collection)] })();

/* Field helpers ----------------------------------------------------------- */

const iso = (v: unknown): string | null => (typeof v === "string" && v ? new Date(v).toISOString() : null);
const day = (v: unknown): string => (typeof v === "string" && v ? v.slice(0, 10) : "");
const textRows = (rows: unknown): string[] => (Array.isArray(rows) ? rows.map((r: Doc) => String(r?.text ?? "")).filter(Boolean) : []);
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const numArr = (v: unknown): number[] => (Array.isArray(v) ? v.map(Number) : []);
const toPath = (p: Doc) => ({
  ...(p?.label ? { label: p.label } : {}),
  assumption: p?.assumption ?? "",
  ...(p?.rate != null ? { rate: Number(p.rate) } : {}),
  ...(Array.isArray(p?.values) && p.values.length ? { values: numArr(p.values) } : {}),
});
function toScenario(s: Doc) {
  return {
    id: s.scenarioKey,
    title: s.title,
    metric: s.metric,
    ...(s.unit ? { unit: s.unit } : {}),
    decimals: Number(s.decimals),
    baseYear: Number(s.baseYear),
    baseValue: Number(s.baseValue),
    years: numArr(s.years),
    scenarios: { downside: toPath(s.downside), base: toPath(s.base), upside: toPath(s.upside) },
    ...(Array.isArray(s.periodLabels) && s.periodLabels.length ? { periodLabels: strArr(s.periodLabels) } : {}),
    period: s.period,
    dataSource: s.dataSource,
    methodology: s.methodology,
  };
}
const idOf = (v: unknown): string | null => (v && typeof v === "object" ? String((v as Doc).id) : v == null ? null : String(v));

type Keys = { insights: Map<string, string>; themes: Map<string, string>; capabilities: Map<string, string> };
const one = (map: Map<string, string>, v: unknown): string | null => {
  const id = idOf(v);
  return id ? (map.get(id) ?? null) : null;
};
const many = (map: Map<string, string>, v: unknown): string[] => (Array.isArray(v) ? (v.map((x) => one(map, x)).filter(Boolean) as string[]) : []);

function publication(d: Doc): Publication {
  return {
    status: d.workflowStatus,
    sample: d.contentClass !== "approved_corporate",
    author: d.author ?? null,
    approvedBy: d.approvedBy ?? null,
    publishedAt: iso(d.publishedAt),
    updatedAt: iso(d.revisedAt) ?? iso(d.updatedAt) ?? new Date(0).toISOString(),
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
      return { type: "list", items: textRows(b.items), ...(b.ordered ? { ordered: true } : {}) };
    case "layer":
      return { type: "layer", layer: b.layer, title: b.title, body: textRows(b.body) };
    case "table":
      return {
        type: "table",
        caption: b.caption,
        columns: strArr(b.columns),
        rows: (Array.isArray(b.rows) ? b.rows : []).map((r: Doc) => strArr(r.cells)),
        ...(b.note ? { note: b.note } : {}),
        ...(b.layer ? { layer: b.layer } : {}),
      };
    case "comparison":
      return { type: "comparison", caption: b.caption, left: b.left, right: b.right, rows: (Array.isArray(b.rows) ? b.rows : []).map((r: Doc) => [r.leftText, r.rightText] as [string, string]) };
    case "chart":
      return {
        type: "chart",
        caption: b.caption,
        kind: b.kind,
        xLabels: strArr(b.xLabels),
        series: (Array.isArray(b.series) ? b.series : []).map((x: Doc) => ({ id: x.seriesKey, label: x.label, values: numArr(x.values) })),
        ...(b.unit ? { unit: b.unit } : {}),
        decimals: b.decimals,
        source: b.source,
        illustrative: b.illustrative !== false,
      };
    case "scenario":
      return { type: "scenario", scenario: toScenario(b.scenario ?? {}) };
    case "callout":
      return { type: "callout", title: b.title, text: b.text };
    case "pullquote":
      return { type: "pullquote", text: b.text };
    default:
      return { type: "paragraph", text: b.text ?? "" };
  }
}

function toInsight(d: Doc, k: Keys): Insight {
  const seo = d.seo && (d.seo.title || d.seo.description) ? { ...(d.seo.title ? { title: d.seo.title } : {}), ...(d.seo.description ? { description: d.seo.description } : {}) } : undefined;
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
    ...(d.featured ? { featured: true } : {}),
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
    ...(d.methodology ? { methodology: d.methodology } : {}),
    body: (Array.isArray(d.body) ? d.body : []).map(toBlock),
    related: many(k.insights, d.related),
    markets: strArr(d.markets),
    themes: many(k.themes, d.themes),
    assetClasses: strArr(d.assetClasses) as Insight["assetClasses"],
    capabilities: many(k.capabilities, d.capabilities),
    marketStateDimensions: strArr(d.marketStateDimensions),
    ...(seo ? { seo } : {}),
  };
}

function toView(d: Doc, k: Keys): NusantaraView {
  const kind = d.subject?.kind;
  const subject = (
    kind === "instrument" ? { kind, id: d.subject.instrument } : kind === "assetClass" ? { kind, id: d.subject.assetClass } : { kind: "indicator", id: d.subject?.indicator }
  ) as NusantaraView["subject"];
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
    relatedInsight: one(k.insights, d.relatedInsight),
    theme: d.theme ?? null,
    marketStateDimensions: strArr(d.marketStateDimensions),
    capabilities: many(k.capabilities, d.capabilities),
  };
}

function toEdition(d: Doc, k: Keys): MarketStateEdition {
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
      relatedInsight: one(k.insights, x.relatedInsight),
      capabilities: many(k.capabilities, x.capabilities),
      updatedAt: iso(x.dimensionUpdatedAt) ?? iso(d.updatedAt)!,
      status: x.dimensionStatus,
    })),
  };
}

const toSignal = (d: Doc, k: Keys): Signal => ({
  ...publication(d),
  id: d.key,
  date: day(d.date),
  theme: d.theme,
  headline: d.headline,
  reading: d.reading,
  ...(d.instrument ? { instrument: d.instrument } : {}),
  insight: one(k.insights, d.insight),
});

const toTheme = (d: Doc, k: Keys): Theme => ({
  ...publication(d),
  id: d.key,
  title: d.title,
  statement: d.statement,
  insights: many(k.insights, d.insights),
  instruments: strArr(d.instruments),
  indicators: strArr(d.indicators),
});

function toCapability(d: Doc, k: Keys): Strategy {
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
    insights: many(k.insights, d.insights),
    // Product details are never CMS content (approved product + data source required).
    product: null,
  };
}

/** Live content, plus — in an authorised preview — the previewed item's working copy. */
export async function loadCmsContent(preview: PreviewTarget | null = null, opts: { cached?: boolean } = {}): Promise<RawContent> {
  // Previews (and server-side checks outside a request) read the database directly.
  const cached = opts.cached !== false && !preview;
  const docs = Object.fromEntries(await Promise.all(CMS_COLLECTIONS.map(async (c) => [c, cached ? await liveDocs(c) : await readLive(c)] as const))) as Record<CmsCollection, Doc[]>;

  let previewKey: RawContent["preview"] = null;
  if (preview) {
    const payload = await getPayload({ config });
    const draft = (await payload.findByID({ collection: preview.collection, id: preview.id, draft: true, depth: 0, overrideAccess: true }).catch(() => null)) as Doc | null;
    if (draft && draft.workflowStatus !== "archived") {
      const list = docs[preview.collection];
      const i = list.findIndex((x) => String(x.id) === String(draft.id));
      if (i >= 0) list[i] = draft;
      else list.push(draft);
      previewKey = { kind: KIND[preview.collection], key: String(draft.slug ?? draft.key) };
    }
  }

  const keys: Keys = {
    insights: new Map(docs.insights.map((d) => [String(d.id), d.slug])),
    themes: new Map(docs.themes.map((d) => [String(d.id), d.key])),
    capabilities: new Map(docs.capabilities.map((d) => [String(d.id), d.slug])),
  };
  return {
    insights: docs.insights.map((d) => toInsight(d, keys)).sort((a, b) => b.date.localeCompare(a.date)),
    views: docs.nusantaraViews.map((d) => toView(d, keys)),
    marketStateEditions: docs.marketStateEditions.map((d) => toEdition(d, keys)),
    signals: docs.signals.map((d) => toSignal(d, keys)),
    themes: docs.themes.map((d) => toTheme(d, keys)),
    capabilities: docs.capabilities.map((d) => toCapability(d, keys)),
    preview: previewKey,
  };
}
