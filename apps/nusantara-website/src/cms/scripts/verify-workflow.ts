/**
 * Verifies the Admin Portal's server-side rules against a real database:
 * roles, workflow transitions, Editor/Approver separation, classification,
 * live-vs-working versions, the audit trail and the CMS content loader.
 *
 *   npm run cms:verify-workflow      (local development database only)
 *
 * Every call runs as a real user with access control ON (overrideAccess:
 * false), exactly like an Admin Portal request. It creates its own test users
 * and documents and deletes them afterwards. Never run against production.
 */
import config from "@payload-config";
import { createLocalReq, getPayload, restoreVersionOperation, type CollectionSlug } from "payload";
import type { User } from "../payload-types";
import { isVisible } from "../../content/model/publication";
import { discardDraftEndpoint } from "../hooks/discard";
import { requireDevelopmentDatabase } from "./guards";

if (process.env.NUSANTARA_ENV === "production" || /neon\.tech|amazonaws|prod/i.test(process.env.DATABASE_URL ?? "")) {
  console.error("Refusing to run against what looks like a production database.");
  process.exit(1);
}

const payload = await getPayload({ config });
await requireDevelopmentDatabase(payload, "verify-workflow");
const startedAt = new Date().toISOString();
const tag = `wf-test-${Date.now()}`;
let passed = 0;
let failed = 0;
const created: { collection: CollectionSlug; id: number }[] = [];

function check(name: string, ok: boolean, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}
async function rejects(name: string, fn: () => Promise<unknown>, expect: RegExp) {
  try {
    await fn();
    check(name, false, "was allowed");
  } catch (e) {
    const msg = (e as Error).message;
    check(name, expect.test(msg), msg);
  }
}

type U = User;
async function user(role: "editor" | "reviewer" | "admin", n: string): Promise<U> {
  const u = await payload.create({ collection: "users", data: { email: `${tag}-${n}@example.invalid`, name: `Test ${n}`, password: `${tag}-Password!`, role }, overrideAccess: true });
  created.push({ collection: "users", id: u.id });
  return u;
}

// The admin first: on an empty database the first account is always made an Admin.
const admin = await user("admin", "admin");
const editor = await user("editor", "editor");
const editor2 = await user("editor", "editor2");
const reviewer = await user("reviewer", "reviewer");
const reviewer2 = await user("reviewer", "reviewer2");

const as = (u: U) => ({ user: u, overrideAccess: false as const });
const viewData = {
  key: `${tag}-view`,
  subject: { kind: "instrument" as const, instrument: "klci" as const },
  signal: "Selective",
  context: "Test context — local verification only.",
  // Time-sensitive interpretation: a future re-review date is part of the approved content.
  reviewAt: new Date(Date.now() + 30 * 86400_000).toISOString(),
};

try {
  /* Users ------------------------------------------------------------- */
  await rejects("password shorter than 12 characters is rejected", () => payload.create({ collection: "users", data: { email: `${tag}-short@example.invalid`, name: "x", password: "short", role: "editor" }, ...as(admin) }), /at least 12/);
  await rejects("editor cannot create users", () => payload.create({ collection: "users", data: { email: `${tag}-x@example.invalid`, name: "x", password: `${tag}-Password!`, role: "editor" }, ...as(editor) }), /not allowed/i);
  await payload.update({ collection: "users", id: editor.id, data: { role: "admin" }, ...as(editor) }).catch(() => null);
  const e1 = await payload.findByID({ collection: "users", id: editor.id, overrideAccess: true });
  check("editor cannot promote themselves", e1.role === "editor", `role is ${e1.role}`);

  /* Separated collection: Nusantara View -------------------------------- */
  const v = await payload.create({ collection: "nusantaraViews", data: viewData, draft: true, ...as(editor) });
  created.push({ collection: "nusantaraViews", id: v.id });
  check("editor creates a draft", v.workflowStatus === "draft" && v.contentClass === "illustrative", `${v.workflowStatus}/${v.contentClass}`);
  check("createdBy recorded server-side", String((v.createdBy as { id?: number })?.id ?? v.createdBy) === String(editor.id));

  await rejects("editor cannot publish", () => payload.update({ collection: "nusantaraViews", id: v.id, data: { _status: "published" }, ...as(editor) }), /Editors cannot publish/);
  await rejects("editor cannot approve", () => payload.update({ collection: "nusantaraViews", id: v.id, data: { workflowStatus: "approved" }, draft: true, ...as(editor) }), /Draft or In review/);

  const spoof = await payload.update({ collection: "nusantaraViews", id: v.id, data: { workflowStatus: "review", approvedBy: "Spoofed Approver", publishedAt: "2020-01-01T00:00:00.000Z" }, draft: true, ...as(editor) });
  check("editor submits for review", spoof.workflowStatus === "review");
  check("who-did-what fields cannot be set by the client", !spoof.approvedBy && !spoof.publishedAt, `approvedBy=${spoof.approvedBy} publishedAt=${spoof.publishedAt}`);

  await rejects("approval cannot include content changes", () => payload.update({ collection: "nusantaraViews", id: v.id, data: { workflowStatus: "approved", signal: "Changed" }, draft: true, ...as(reviewer) }), /cannot include content changes/);

  // A reviewer who edits the item becomes its last editor and so cannot approve it.
  await payload.update({ collection: "nusantaraViews", id: v.id, data: { context: "Edited by reviewer2." }, draft: true, ...as(reviewer2) });
  await rejects("reviewer who edited the item cannot approve it", () => payload.update({ collection: "nusantaraViews", id: v.id, data: { workflowStatus: "approved" }, draft: true, ...as(reviewer2) }), /cannot approve/);

  const approved = await payload.update({ collection: "nusantaraViews", id: v.id, data: { workflowStatus: "approved" }, draft: true, ...as(reviewer) });
  check("a different reviewer approves", approved.workflowStatus === "approved" && approved.approvedBy === "Test reviewer", `${approved.workflowStatus} by ${approved.approvedBy}`);

  await rejects("the item's own editor (reviewer2) cannot publish", () => payload.update({ collection: "nusantaraViews", id: v.id, data: { _status: "published" }, ...as(reviewer2) }), /cannot publish/);

  const pub = await payload.update({ collection: "nusantaraViews", id: v.id, data: { _status: "published" }, ...as(reviewer) });
  check("approver publishes the approved content", pub.workflowStatus === "published" && pub._status === "published" && !!pub.publishedAt);
  check("publishing does not change classification", pub.contentClass === "illustrative", pub.contentClass ?? "");

  // Working copy changes; the live version stays live.
  const draft2 = await payload.update({ collection: "nusantaraViews", id: v.id, data: { signal: "Cautious" }, draft: true, ...as(editor2) });
  check("editing published content returns the working copy to Draft", draft2.workflowStatus === "draft", draft2.workflowStatus ?? "");
  const live = await payload.findByID({ collection: "nusantaraViews", id: v.id, draft: false, overrideAccess: true });
  check("the live version is unchanged until re-published", live.signal === "Selective" && live.workflowStatus === "published", `${live.signal}/${live.workflowStatus}`);
  // A save without the draft flag (e.g. a crafted API request) never reaches the live version.
  await payload.update({ collection: "nusantaraViews", id: v.id, data: { signal: "Overwrite attempt" }, ...as(editor2) });
  const liveStill = await payload.findByID({ collection: "nusantaraViews", id: v.id, draft: false, overrideAccess: true });
  check("a non-draft save cannot overwrite the live version", liveStill.signal === "Selective" && liveStill._status === "published", `${liveStill.signal}/${liveStill._status}`);
  await rejects("editors cannot unpublish live content", () => payload.update({ collection: "nusantaraViews", id: v.id, data: { _status: "draft" }, ...as(editor) }), /Only a Reviewer or Admin may unpublish/);
  await rejects("changed content cannot be published without re-approval", () => payload.update({ collection: "nusantaraViews", id: v.id, data: { _status: "published", workflowStatus: "published" }, ...as(reviewer) }), /Only an approved item|differs from what was approved/);

  /* Classification ----------------------------------------------------- */
  await rejects("reviewer cannot confirm Approved corporate content", () => payload.update({ collection: "nusantaraViews", id: v.id, data: { contentClass: "approved_corporate" }, draft: true, ...as(reviewer) }), /Only an Admin/);
  const cls = await payload.update({ collection: "nusantaraViews", id: v.id, data: { contentClass: "approved_corporate" }, draft: true, ...as(admin) });
  check("admin confirms classification, recorded with who/when", cls.contentClass === "approved_corporate" && !!cls.classificationConfirmedAt && String((cls.classificationConfirmedBy as { id?: number })?.id ?? cls.classificationConfirmedBy) === String(admin.id));
  check("classification change leaves workflow unchanged", cls.workflowStatus === "draft", cls.workflowStatus ?? "");

  /* Proportionate collection: Insight ----------------------------------- */
  const ins = await payload.create({
    collection: "insights",
    data: { slug: `${tag}-insight`, title: "Test insight", subtitle: "Local verification only", category: "Research Notes", date: "2026-10-01", summary: "Test.", heroMotif: "arcs" },
    draft: true,
    ...as(editor),
  });
  created.push({ collection: "insights", id: ins.id });
  await rejects("editor cannot publish an insight", () => payload.update({ collection: "insights", id: ins.id, data: { _status: "published" }, ...as(editor) }), /Editors cannot publish/);
  const insPub = await payload.update({ collection: "insights", id: ins.id, data: { _status: "published" }, ...as(reviewer) });
  check("reviewer approves and publishes ordinary content in one step", insPub.workflowStatus === "published" && insPub.approvedBy === "Test reviewer");
  check("ordinary content stays Illustrative unless an Admin confirms it", insPub.contentClass === "illustrative");

  /* Archive -------------------------------------------------------------- */
  await rejects("editor cannot archive", () => payload.update({ collection: "insights", id: ins.id, data: { workflowStatus: "archived" }, draft: true, ...as(editor) }), /Draft or In review|archive/);
  const arch = await payload.update({ collection: "insights", id: ins.id, data: { workflowStatus: "archived", _status: "published" }, ...as(reviewer) });
  check("reviewer archives (withdraws) a live item", arch.workflowStatus === "archived");

  /* Access --------------------------------------------------------------- */
  await rejects("editor cannot delete", () => payload.delete({ collection: "insights", id: ins.id, ...as(editor) }), /not allowed/i);
  await rejects("nobody can edit the audit log", () => payload.create({ collection: "auditLog", data: { at: new Date().toISOString(), action: "edit", collection: "x", documentId: "1", summary: "forged" }, ...as(admin) }), /not allowed/i);
  const auditForEditor = await payload.find({ collection: "auditLog", ...as(editor) }).then(() => "allowed", () => "denied");
  check("editors cannot read the audit log", auditForEditor === "denied", auditForEditor);

  /* Time-sensitive publishing (signals) --------------------------------- */
  const sig = await payload.create({
    collection: "signals",
    data: { key: `${tag}-signal`, date: "2026-10-03", theme: "Test", headline: "Test signal", reading: "Local verification only." },
    draft: true,
    ...as(editor),
  });
  created.push({ collection: "signals", id: sig.id });
  await rejects("time-sensitive content cannot be published without a future re-review date", () => payload.update({ collection: "signals", id: sig.id, data: { _status: "published" }, ...as(reviewer) }), /Re-review by/);
  const sigPub = await payload.update({ collection: "signals", id: sig.id, data: { reviewAt: new Date(Date.now() + 7 * 86400_000).toISOString(), _status: "published" }, ...as(reviewer) });
  check("with a re-review date it publishes", sigPub.workflowStatus === "published");
  await payload.update({ collection: "signals", id: sig.id, data: { _status: "draft" }, ...as(reviewer) });
  const sigLive = await payload.findByID({ collection: "signals", id: sig.id, draft: false, overrideAccess: true });
  check("a reviewer can unpublish (withdraw) live content", sigLive._status === "draft" && sigLive.workflowStatus === "draft", `${sigLive._status}/${sigLive.workflowStatus}`);

  /* Version restore ------------------------------------------------------- */
  const versions = await payload.findVersions({ collection: "nusantaraViews", where: { parent: { equals: v.id } }, sort: "createdAt", limit: 50, overrideAccess: true });
  const publishedVersion = versions.docs.find((x) => (x.version as { workflowStatus?: string }).workflowStatus === "published");
  check("version history records each change", versions.docs.length >= 5, `${versions.docs.length} versions`);
  if (publishedVersion) {
    await rejects("a restore cannot replace the live version directly", () => payload.restoreVersion({ collection: "nusantaraViews", id: publishedVersion.id, ...as(reviewer2) }), /restored as a Draft/);
    // The same operation the REST endpoint runs (the Local API wrapper does not pass `draft`).
    const restored = await restoreVersionOperation({
      id: publishedVersion.id,
      collection: payload.collections.nusantaraViews,
      draft: true,
      overrideAccess: false,
      req: await createLocalReq({ user: reviewer2 }, payload),
    });
    const latest = await payload.findByID({ collection: "nusantaraViews", id: v.id, draft: true, overrideAccess: true });
    const liveAfter = await payload.findByID({ collection: "nusantaraViews", id: v.id, draft: false, overrideAccess: true });
    check("restoring creates a Draft working copy", latest.workflowStatus === "draft" && latest.signal === "Selective", `${latest.workflowStatus}/${latest.signal} (restore returned ${restored?.id ? "doc" : "nothing"})`);
    check("the live version is untouched by a restore", liveAfter.workflowStatus === "published" && liveAfter._status === "published");
    await payload.update({ collection: "nusantaraViews", id: v.id, data: { workflowStatus: "review" }, draft: true, ...as(reviewer2) });
    await rejects("whoever restored a version cannot approve it", () => payload.update({ collection: "nusantaraViews", id: v.id, data: { workflowStatus: "approved" }, draft: true, ...as(reviewer2) }), /cannot approve/);
    await rejects("restored content cannot be published without fresh approval", () => payload.update({ collection: "nusantaraViews", id: v.id, data: { _status: "published" }, ...as(reviewer) }), /Only an approved item|differs from what was approved/);
  } else check("a published version exists to restore", false);

  /* Discard draft changes ------------------------------------------------ */
  const discard = async (collection: CollectionSlug, id: number, user: U) => {
    const req = await createLocalReq({ user }, payload);
    req.routeParams = { id: String(id) };
    const res = await discardDraftEndpoint(collection).handler(req);
    return { status: res.status, body: (await res.json()) as { message?: string; discarded?: number } };
  };
  const liveBeforeDiscard = await payload.findByID({ collection: "nusantaraViews", id: v.id, draft: false, overrideAccess: true });
  const d1 = await discard("nusantaraViews", v.id, editor);
  const wc = await payload.findByID({ collection: "nusantaraViews", id: v.id, draft: true, overrideAccess: true });
  const liveAfterDiscard = await payload.findByID({ collection: "nusantaraViews", id: v.id, draft: false, overrideAccess: true });
  check("an Editor can discard draft changes", d1.status === 200 && (d1.body.discarded ?? 0) > 0, `${d1.status} ${d1.body.message}`);
  check("after discarding, the working copy is the published version", wc.workflowStatus === "published" && wc.signal === liveBeforeDiscard.signal && wc.context === liveBeforeDiscard.context, `wc=${wc.workflowStatus}/${wc.signal}/${wc.context} live=${liveBeforeDiscard.workflowStatus}/${liveBeforeDiscard.signal}/${liveBeforeDiscard.context}`);
  check("discarding never changes the live version", JSON.stringify(liveAfterDiscard) === JSON.stringify(liveBeforeDiscard));
  const d2 = await discard("nusantaraViews", v.id, editor);
  check("discarding again with no changes is harmless", d2.status === 200 && d2.body.discarded === 0);
  const next = await payload.update({ collection: "nusantaraViews", id: v.id, data: { signal: "After discard" }, draft: true, ...as(editor) });
  check("the next edit follows the normal workflow (back to Draft)", next.workflowStatus === "draft");
  await discard("nusantaraViews", v.id, editor);

  /* Capabilities: no products through the CMS ---------------------------- */
  await rejects("editors cannot create capabilities", () => payload.create({ collection: "capabilities", data: { slug: `${tag}-cap-x`, name: "x", stage: "capability", summary: "x", overview: "x", approach: "x", role: "x" }, draft: true, ...as(editor) }), /not allowed/i);
  const cap = await payload.create({
    collection: "capabilities",
    data: { slug: `${tag}-cap`, name: "Test capability", capabilityStatus: "internal", stage: "capability", summary: "Test.", overview: "Test.", approach: "Test.", role: "Test." },
    draft: true,
    ...as(admin),
  });
  created.push({ collection: "capabilities", id: cap.id });
  await rejects("an investment product cannot be created through the CMS", () => payload.update({ collection: "capabilities", id: cap.id, data: { capabilityStatus: "active-product", stage: "active" }, draft: true, ...as(admin) }), /investment product cannot be created/);
  const capEd = await payload.update({ collection: "capabilities", id: cap.id, data: { capabilityStatus: "public-capability", summary: "Edited summary." }, draft: true, ...as(editor) });
  check("editors edit descriptive content but not the lifecycle", capEd.summary === "Edited summary." && capEd.capabilityStatus === "internal", `${capEd.capabilityStatus}`);
  const neverPublished = await discard("capabilities", cap.id, editor);
  check("discard refuses an item that was never published (nothing to return to)", neverPublished.status === 409, String(neverPublished.status));

  /* CMS content source (CONTENT_SOURCE=cms) ------------------------------- */
  // The site's own loader, as the content repository uses it. This run is the
  // review environment (NUSANTARA_ENV unset), which reads latest versions and
  // leaves Draft and Archived items out.
  const theme = await payload.create({
    collection: "themes",
    data: { key: `${tag}-theme`, title: "Test theme", statement: "Local verification only.", instruments: ["klci", "gold"] },
    draft: true,
    ...as(editor),
  });
  created.push({ collection: "themes", id: theme.id });
  await payload.update({ collection: "themes", id: theme.id, data: { _status: "published" }, ...as(reviewer) });
  const { loadCmsContent } = await import("../../lib/content/cms-source");
  const raw = await loadCmsContent(null, { cached: false });
  const t = raw.themes.find((x) => x.id === `${tag}-theme`);
  check("CMS loader maps a published theme to the site's Theme type", !!t && t.title === "Test theme" && t.instruments.join() === "klci,gold" && t.status === "published", JSON.stringify(t ?? null).slice(0, 160));
  check("CMS loader marks non-confirmed content as sample (never shown in production)", t?.sample === true);
  const liveView = raw.views.find((x) => x.id === `${tag}-view`);
  check("public reads return the LIVE version, never the working copy", liveView?.signal === "Selective" && liveView?.status === "published", `${liveView?.signal}/${liveView?.status}`);
  const archivedInsight = raw.insights.find((x) => x.slug === `${tag}-insight`);
  check("an archived (withdrawn) item is never visible", !archivedInsight || !isVisible(archivedInsight as never, { visibleStatuses: ["review", "approved", "published"], allowSampleContent: true }), archivedInsight?.status ?? "absent");
  check("a never-published draft is not loaded at all", !raw.capabilities.some((x) => x.slug === `${tag}-cap`));

  /* Audit trail ---------------------------------------------------------- */
  const audit = await payload.find({ collection: "auditLog", where: { and: [{ collection: { equals: "nusantaraViews" } }, { documentId: { equals: String(v.id) } }] }, limit: 100, overrideAccess: true });
  const actions = audit.docs.map((d) => d.action);
  check("audit trail records submit, approve, publish, classify, restore and discard", ["create", "submit", "approve", "publish", "classify", "restore", "discard"].every((a) => actions.includes(a as never)), actions.join(","));
} finally {
  for (const c of created.reverse()) {
    if (c.collection !== "users") await payload.delete({ collection: c.collection, id: c.id, overrideAccess: true }).catch(() => {});
  }
  for (const c of created) if (c.collection === "users") await payload.delete({ collection: "users", id: c.id, overrideAccess: true }).catch(() => {});
  // Test entries only: everything this run wrote to the audit log.
  await payload.delete({ collection: "auditLog", where: { at: { greater_than_equal: startedAt } }, overrideAccess: true }).catch(() => {});
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
