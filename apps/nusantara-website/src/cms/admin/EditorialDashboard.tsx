import Link from "next/link";
import type { CollectionSlug, ServerProps } from "payload";
import { config as site } from "@/lib/config";
import { getMarketSnapshot } from "@/lib/market/service";
import { CONTENT_CLASS_LABEL, type ContentClass, type WorkflowStatus } from "../fields/workflow";

/**
 * Management landing view for /admin: where the editorial work stands.
 * Read-only. Counts reflect each item's working copy (its latest version).
 * Market-data status is shown for information only — market data is not CMS
 * content and cannot be edited here.
 */

type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const EDITORIAL: { slug: CollectionSlug; label: string; title: (d: Doc) => string }[] = [
  { slug: "insights", label: "Insight", title: (d) => d.title },
  { slug: "nusantaraViews", label: "Nusantara View", title: (d) => viewTitle(d) },
  { slug: "marketStateEditions", label: "Market State", title: (d) => `Market State · ${d.edition}` },
  { slug: "signals", label: "Signal", title: (d) => d.headline },
  { slug: "themes", label: "Theme", title: (d) => d.title },
  { slug: "capabilities", label: "Capability", title: (d) => d.name },
];
const STATUS_LABEL: Record<WorkflowStatus, string> = { draft: "Draft", review: "In review", approved: "Approved", published: "Published", archived: "Archived" };

function viewTitle(d: Doc): string {
  const s = d.subject ?? {};
  const subject = s.kind === "instrument" ? s.instrument : s.kind === "assetClass" ? s.assetClass : s.indicator;
  return `${String(subject ?? d.key).toUpperCase()} — ${d.signal ?? "Nusantara View"}`;
}
const when = (v?: string | null) =>
  v ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(v)) + " MYT" : "—";

type Item = { collection: CollectionSlug; label: string; id: string; title: string; status: WorkflowStatus; contentClass: ContentClass; updatedAt: string; live: boolean; doc: Doc };

function Row({ item }: { item: Item }) {
  return (
    <li>
      <Link href={`/admin/collections/${item.collection}/${item.id}`}>{item.title}</Link>
      <span className="nd-meta">
        {item.label} · <span className={`nd-status nd-status--${item.status}`}>{STATUS_LABEL[item.status]}</span> · {CONTENT_CLASS_LABEL[item.contentClass]} · {when(item.updatedAt)}
      </span>
    </li>
  );
}

export async function EditorialDashboard({ payload, user }: ServerProps) {
  if (!user) return null;
  const all: Item[] = [];
  for (const c of EDITORIAL) {
    const res = await payload.find({ collection: c.slug, draft: true, depth: 0, limit: 500, pagination: false, user, overrideAccess: false });
    for (const d of res.docs as Doc[]) {
      all.push({ collection: c.slug, label: c.label, id: String(d.id), title: c.title(d), status: d.workflowStatus, contentClass: d.contentClass, updatedAt: d.updatedAt, live: d._status === "published" || !!d.publishedAt, doc: d });
    }
  }
  const count = (s: WorkflowStatus) => all.filter((i) => i.status === s).length;
  const inReview = all.filter((i) => i.status === "review");
  const migratedInReview = inReview.filter((i) => i.doc.legacy?.key && !i.doc.submittedBy).length;
  const viewsInReview = inReview.filter((i) => i.collection === "nusantaraViews");
  const approved = all.filter((i) => i.status === "approved");
  const recent = [...all].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8);
  const latestInsights = all.filter((i) => i.collection === "insights").sort((a, b) => String(b.doc.date).localeCompare(String(a.doc.date))).slice(0, 5);
  const editions = all.filter((i) => i.collection === "marketStateEditions").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const edition = editions[0];
  const snapshot = await getMarketSnapshot().catch(() => null);

  return (
    <section className="nusantara-dashboard" aria-label="Editorial overview">
      <header className="nd-head">
        <h2>Editorial overview</h2>
        <p>Working copies across research and Nusantara interpretation. Nothing here changes the live website until it is published.</p>
      </header>

      <div className="nd-counts">
        {(["draft", "review", "approved", "published", "archived"] as WorkflowStatus[]).map((s) => (
          <div key={s} className={`nd-count nd-status--${s}`}>
            <strong>{count(s)}</strong>
            <span>{STATUS_LABEL[s]}</span>
          </div>
        ))}
      </div>

      <div className="nd-grid">
        <div className="nd-card">
          <h3>Requiring review ({inReview.length})</h3>
          {migratedInReview > 0 && <p className="nd-note">{migratedInReview} migrated items keep the “In review” status they had on the review website; none has been approved.</p>}
          <ul>{inReview.slice(0, 8).map((i) => <Row key={`${i.collection}-${i.id}`} item={i} />)}</ul>
        </div>

        <div className="nd-card">
          <h3>Nusantara Views requiring review ({viewsInReview.length})</h3>
          <p className="nd-note">Approval must come from a different Reviewer or Admin than the editor or submitter.</p>
          <ul>{viewsInReview.slice(0, 8).map((i) => <Row key={i.id} item={i} />)}</ul>
          {approved.length > 0 && (
            <>
              <h4>Approved, awaiting publication ({approved.length})</h4>
              <ul>{approved.slice(0, 5).map((i) => <Row key={`${i.collection}-${i.id}`} item={i} />)}</ul>
            </>
          )}
        </div>

        <div className="nd-card">
          <h3>Market State</h3>
          {edition ? (
            <dl className="nd-dl">
              <dt>Edition</dt>
              <dd><Link href={`/admin/collections/marketStateEditions/${edition.id}`}>{edition.doc.edition}</Link></dd>
              <dt>Workflow</dt>
              <dd>{STATUS_LABEL[edition.status]} · {CONTENT_CLASS_LABEL[edition.contentClass]}</dd>
              <dt>Dimensions</dt>
              <dd>{(edition.doc.dimensions ?? []).map((d: Doc) => `${d.label} (${STATUS_LABEL[d.dimensionStatus as WorkflowStatus] ?? d.dimensionStatus})`).join(" · ")}</dd>
              <dt>Re-review by</dt>
              <dd>{when(edition.doc.reviewAt)}</dd>
              <dt>Last update</dt>
              <dd>{when(edition.doc.revisedAt ?? edition.updatedAt)}</dd>
            </dl>
          ) : (
            <p className="nd-note">No Market State edition.</p>
          )}
        </div>

        <div className="nd-card">
          <h3>Latest Insights</h3>
          <ul>{latestInsights.map((i) => <Row key={i.id} item={i} />)}</ul>
        </div>

        <div className="nd-card">
          <h3>Recently updated</h3>
          <ul>{recent.map((i) => <Row key={`${i.collection}-${i.id}`} item={i} />)}</ul>
        </div>

        <div className="nd-card nd-card--readonly">
          <h3>Market data (read-only)</h3>
          <p className="nd-note">Prices, changes, histories and timestamps come from the market-data provider. They are not CMS content.</p>
          <dl className="nd-dl">
            <dt>Environment</dt>
            <dd>{site.environment === "review" ? "Management review" : site.environment}</dd>
            <dt>Provider</dt>
            <dd>{site.marketDataProvider}</dd>
            <dt>Status</dt>
            <dd>{snapshot ? `${snapshot.provenance.status} · ${snapshot.provenance.source}` : "Unavailable"}</dd>
            <dt>As of</dt>
            <dd>{when(snapshot?.provenance.asOf)}</dd>
          </dl>
        </div>
      </div>
    </section>
  );
}
