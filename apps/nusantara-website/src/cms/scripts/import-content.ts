/**
 * IMPORT — the existing code-based editorial content into the Admin Portal.
 *
 *   npm run cms:import            (local development database)
 *   CMS_IMPORT_DRY=1 npm run cms:import   report only
 *
 * Preserves every id/slug, wording, relationship, date, publication status
 * and sample flag. Classification is carried, never upgraded: nothing becomes
 * Approved corporate content.
 *   - Nusantara Views, Market State, Signals (labelled "Illustrative
 *     interpretation" on the site)                       → Illustrative
 *   - Insights, Themes, Capabilities (written for management review) → Management review
 * The legacy status, sample flag and update date are also kept verbatim in
 * each record's read-only "Migrated record" group.
 *
 * Each record is imported as its LIVE version (what the website renders) with
 * its legacy workflow status — e.g. In review — exactly as the management-
 * review site shows it today. No approval is recorded or implied.
 *
 * Idempotent: each record carries a fingerprint of its source. Re-running
 * skips unchanged records, updates records nobody has edited in the Admin
 * Portal, and never overwrites a record that has been edited there.
 *
 * Order follows the relationships: insights (text first, related research in
 * a second pass) → themes → capabilities → signals → Nusantara Views →
 * Market State.
 */
import { createHash } from "node:crypto";
import config from "@payload-config";
import { getPayload, type CollectionSlug } from "payload";
import { MARKET_STATE_EDITIONS } from "../../content/data/market-state";
import { MARKET_VIEWS } from "../../content/data/market-views";
import { SIGNALS } from "../../content/data/signals";
import { THEMES } from "../../content/data/themes";
import { getAllInsights } from "../../content/insights";
import type { Block, Insight, ScenarioPath } from "../../content/insights/types";
import type { Publication } from "../../content/model/publication";
import type { Stance } from "../../content/model/intelligence";
import { STRATEGIES } from "../../content/strategies";

// `payload run` does not forward script arguments, so the dry run is an environment flag.
const DRY = process.env.CMS_IMPORT_DRY === "1" || process.argv.includes("--dry");
const payload = await getPayload({ config });
type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const report: Record<string, { created: number; updated: number; unchanged: number; skippedEdited: string[] }> = {};

const fingerprint = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const rows = (lines: string[] | undefined) => (lines ?? []).map((text) => ({ text }));
const stance = (s: Stance | null) => (s ? { scale: s.scale.map((label) => ({ label })), position: s.position } : { scale: [], position: null });

function governance(p: Omit<Publication, "author"> & { author?: string | null }, legacyKey: string, contentClass: "illustrative" | "management_review", order: number, source: unknown) {
  return {
    workflowStatus: p.status,
    contentClass,
    author: p.author ?? null,
    approvedBy: p.approvedBy,
    publishedAt: p.publishedAt,
    reviewAt: p.reviewAt,
    revisedAt: p.updatedAt,
    displayOrder: order,
    legacy: { key: legacyKey, status: p.status, sample: p.sample, updatedAt: p.updatedAt, importHash: fingerprint(source) },
  };
}

/**
 * Production-safety rules for every imported record: no TEST records (the
 * typed files contain none; this keeps it that way) and never Approved
 * Corporate Content — that classification is only ever set by an Admin.
 */
function assertImportable(collection: string, key: string, data: Doc) {
  const title = String(data.title ?? data.name ?? data.headline ?? data.edition ?? "");
  if (/^test[-_]/i.test(key) || /^TEST\b/.test(title)) throw new Error(`Refusing to import TEST record ${collection}/${key}.`);
  if (data.contentClass === "approved_corporate") throw new Error(`Refusing to import ${collection}/${key} as Approved Corporate Content.`);
}

/** Upsert one record by its stable key field. */
async function upsert(collection: CollectionSlug, keyField: string, key: string, data: Doc): Promise<Doc | null> {
  assertImportable(collection, key, data);
  const r = (report[collection] ??= { created: 0, updated: 0, unchanged: 0, skippedEdited: [] });
  const found = (await payload.find({ collection, where: { [keyField]: { equals: key } }, draft: true, limit: 1, depth: 0, overrideAccess: true })).docs[0] as Doc | undefined;
  if (found?.legacy?.importHash === data.legacy.importHash) {
    r.unchanged++;
    return found ?? null;
  }
  if (found && (found.lastEditedBy || found.createdBy)) {
    r.skippedEdited.push(key);
    return found;
  }
  if (DRY) {
    if (found) r.updated++;
    else r.created++;
    return found ?? null;
  }
  const payloadData = { ...data, _status: "published" as const };
  if (found) {
    r.updated++;
    return (await payload.update({ collection, id: found.id, data: payloadData as never, draft: false, overrideAccess: true, depth: 0 })) as Doc;
  }
  r.created++;
  return (await payload.create({ collection, data: payloadData as never, draft: false, overrideAccess: true, depth: 0 })) as Doc;
}

const idMap = { insights: new Map<string, number>(), themes: new Map<string, number>(), capabilities: new Map<string, number>() };
const ref = (map: Map<string, number>, key: string | null | undefined) => (key ? (map.get(key) ?? null) : null);
const refs = (map: Map<string, number>, keys: string[] | undefined) => (keys ?? []).map((k) => map.get(k)).filter((x): x is number => x != null);

function block(b: Block): Doc {
  switch (b.type) {
    case "heading":
      return { blockType: "heading", text: b.text, anchor: b.id };
    case "list":
      return { blockType: "list", items: rows(b.items), ordered: !!b.ordered };
    case "layer":
      return { blockType: "layer", layer: b.layer, title: b.title, body: rows(b.body) };
    case "table":
      return { blockType: "table", caption: b.caption, columns: b.columns, rows: b.rows.map((cells) => ({ cells })), note: b.note ?? null, layer: b.layer ?? null };
    case "comparison":
      return { blockType: "comparison", caption: b.caption, left: b.left, right: b.right, rows: b.rows.map(([leftText, rightText]) => ({ leftText, rightText })) };
    case "chart":
      return {
        blockType: "chart",
        caption: b.caption,
        kind: b.kind,
        xLabels: b.xLabels,
        series: b.series.map((x) => ({ seriesKey: x.id, label: x.label, values: x.values })),
        unit: b.unit ?? null,
        decimals: b.decimals,
        source: b.source,
        illustrative: b.illustrative,
      };
    case "scenario": {
      const sc = b.scenario;
      const p = (x: ScenarioPath) => ({ label: x.label ?? null, assumption: x.assumption, values: x.values ?? [], rate: x.rate ?? null });
      return {
        blockType: "scenario",
        scenario: {
          scenarioKey: sc.id,
          title: sc.title,
          metric: sc.metric,
          unit: sc.unit ?? null,
          decimals: sc.decimals,
          baseYear: sc.baseYear,
          baseValue: sc.baseValue,
          years: sc.years,
          periodLabels: sc.periodLabels ?? [],
          downside: p(sc.scenarios.downside),
          base: p(sc.scenarios.base),
          upside: p(sc.scenarios.upside),
          period: sc.period,
          dataSource: sc.dataSource,
          methodology: sc.methodology,
        },
      };
    }
    case "callout":
      return { blockType: "callout", title: b.title, text: b.text };
    case "pullquote":
      return { blockType: "pullquote", text: b.text };
    default:
      return { blockType: "paragraph", text: b.text };
  }
}

const insightData = (i: Insight, order: number, withRelations: boolean): Doc => ({
  slug: i.slug,
  title: i.title,
  subtitle: i.subtitle,
  category: i.category,
  date: i.date,
  summary: i.summary,
  executiveSummary: rows(i.executiveSummary),
  keyTakeaways: rows(i.keyTakeaways),
  body: i.body.map(block),
  methodology: i.methodology ?? null,
  sources: i.sources.map((s) => ({ ...s })),
  featured: !!i.featured,
  heroMotif: i.hero.motif,
  tags: i.tags,
  markets: i.markets ?? [],
  assetClasses: i.assetClasses ?? [],
  marketStateDimensions: i.marketStateDimensions ?? [],
  ...(withRelations ? { related: refs(idMap.insights, i.related), themes: refs(idMap.themes, i.themes), capabilities: refs(idMap.capabilities, i.capabilities) } : {}),
  ...governance(i, i.slug, "management_review", order, i),
});

/* 1. Insights — text first; relationships once every insight exists. */
const insights = getAllInsights();
const insightHash = (i: Insight) => fingerprint({ insight: i, withRelations: true, blocks: "structured-v2" });
for (const [n, i] of insights.entries()) {
  const data = insightData(i, n * 10, false);
  data.legacy.importHash = insightHash(i);
  // A new record is written with a provisional fingerprint until its relationships are set (1b).
  const existing = (await payload.find({ collection: "insights", where: { slug: { equals: i.slug } }, draft: true, limit: 1, depth: 0, overrideAccess: true })).docs[0];
  if (!existing) data.legacy.importHash = "pending-relationships";
  const doc = await upsert("insights", "slug", i.slug, data);
  if (doc) idMap.insights.set(i.slug, doc.id);
}

/* 2. Themes */
for (const [n, t] of THEMES.entries()) {
  const doc = await upsert("themes", "key", t.id, {
    key: t.id,
    title: t.title,
    statement: t.statement,
    insights: refs(idMap.insights, t.insights),
    instruments: t.instruments,
    indicators: t.indicators,
    ...governance(t, t.id, "management_review", n * 10, t),
  });
  if (doc) idMap.themes.set(t.id, doc.id);
}

/* 3. Capabilities (no product details — never CMS content) */
for (const [n, c] of STRATEGIES.entries()) {
  const p = c.profile;
  const doc = await upsert("capabilities", "slug", c.slug, {
    slug: c.slug,
    name: c.name,
    capabilityStatus: c.status,
    stage: c.stage,
    summary: c.summary,
    overview: c.overview,
    approach: c.approach,
    opportunitySet: rows(c.opportunitySet),
    riskConsiderations: rows(c.riskConsiderations),
    timeHorizon: c.timeHorizon,
    characteristics: rows(c.characteristics),
    role: c.role,
    profile: p
      ? { liquidity: String(p.liquidity), income: String(p.income), complexity: String(p.complexity), valuationFrequency: String(p.valuationFrequency) }
      : { liquidity: null, income: null, complexity: null, valuationFrequency: null },
    markets: c.markets,
    indicators: c.indicators,
    insights: refs(idMap.insights, c.insights),
    // Capabilities carry a lifecycle status (kept above), not a publication record: no publication
    // fields are invented. Workflow "In review" matches how the review site shows them today.
    workflowStatus: "review",
    contentClass: "management_review",
    displayOrder: n * 10,
    legacy: { key: c.slug, status: null, sample: null, updatedAt: null, importHash: fingerprint(c) },
  });
  if (doc) idMap.capabilities.set(c.slug, doc.id);
}

/* 1b. Insight relationships (related research, themes, capabilities) */
for (const [n, i] of insights.entries()) {
  const data = insightData(i, n * 10, true);
  data.legacy.importHash = insightHash(i);
  await upsert("insights", "slug", i.slug, data);
}

/* 4. Signals */
for (const [n, s] of SIGNALS.entries()) {
  await upsert("signals", "key", s.id, {
    key: s.id,
    date: s.date,
    theme: s.theme,
    headline: s.headline,
    reading: s.reading,
    instrument: s.instrument ?? null,
    insight: ref(idMap.insights, s.insight),
    ...governance(s, s.id, "illustrative", n * 10, s),
  });
}

/* 5. Nusantara Views */
for (const [n, v] of MARKET_VIEWS.entries()) {
  await upsert("nusantaraViews", "key", v.id, {
    key: v.id,
    subject: {
      kind: v.subject.kind,
      instrument: v.subject.kind === "instrument" ? v.subject.id : null,
      assetClass: v.subject.kind === "assetClass" ? v.subject.id : null,
      indicator: v.subject.kind === "indicator" ? v.subject.id : null,
    },
    signal: v.signal,
    stance: stance(v.stance),
    summary: v.summary,
    context: v.context,
    whatWeAreWatching: rows(v.whatWeAreWatching),
    keyRisk: v.keyRisk,
    whatWouldChangeOurView: v.whatWouldChangeOurView,
    relatedMarkets: v.relatedMarkets,
    relatedInsight: ref(idMap.insights, v.relatedInsight),
    theme: v.theme,
    marketStateDimensions: v.marketStateDimensions ?? [],
    capabilities: refs(idMap.capabilities, v.capabilities),
    ...governance(v, v.id, "illustrative", n * 10, v),
  });
}

/* 6. Market State */
for (const [n, e] of MARKET_STATE_EDITIONS.entries()) {
  await upsert("marketStateEditions", "key", e.id, {
    key: e.id,
    edition: e.edition,
    framing: { title: e.framing?.title ?? null, note: e.framing?.note ?? null },
    dimensions: e.dimensions.map((d) => ({
      dimension: d.id,
      label: d.label,
      state: d.state,
      stance: stance(d.stance),
      summary: d.summary,
      watchItems: rows(d.watchItems),
      changeConditions: d.changeConditions,
      supportingMarkets: d.supportingMarkets,
      relatedInsight: ref(idMap.insights, d.relatedInsight),
      capabilities: refs(idMap.capabilities, d.capabilities),
      dimensionUpdatedAt: d.updatedAt,
      dimensionStatus: d.status,
    })),
    ...governance(e, e.id, "illustrative", n * 10, e),
  });
}

console.log(DRY ? "DRY RUN — nothing written" : "Import complete");
for (const [c, r] of Object.entries(report)) {
  console.log(`${c.padEnd(20)} created ${r.created}, updated ${r.updated}, unchanged ${r.unchanged}${r.skippedEdited.length ? `, NOT overwritten (edited in Admin Portal): ${r.skippedEdited.join(", ")}` : ""}`);
}
process.exit(0);
