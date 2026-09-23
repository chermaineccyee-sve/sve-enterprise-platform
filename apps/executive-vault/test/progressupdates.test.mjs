import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./loadApp.mjs";

/* ---------- Data model / privacy gate ---------- */

test("managementProgressNotes() never returns a private entry, even one on a management-visible Matter (pn9 on matter-vt-hrtransform)", () => {
  const sandbox = loadApp();
  const notes = sandbox.managementProgressNotes();
  assert.ok(sandbox.managementVisibleMatters().some((m) => m.id === "matter-vt-hrtransform"), "fixture precondition: the Matter itself must be management-visible");
  assert.ok(!notes.some((n) => n.id === "pn9"), "a private entry must never appear merely because its Matter is visible");
  assert.ok(!notes.some((n) => /Personal note/.test(n.text)));
});

test("managementProgressUpdatesInRange() applies the same double gate across a date range", () => {
  const sandbox = loadApp();
  const inRange = sandbox.managementProgressUpdatesInRange("2026-09-01", "2026-09-30");
  assert.ok(!inRange.some((n) => n.id === "pn9"));
  assert.ok(!inRange.some((n) => n.id === "pn6")); // private, matter not visible anyway
  assert.ok(inRange.some((n) => n.id === "pn1"));
});

test("progressUpdatesForMatter() is Ching Yee's own private view and is NOT gated on includeInManagementUpdate", () => {
  const sandbox = loadApp();
  const all = sandbox.progressUpdatesForMatter("matter-vt-hrtransform");
  assert.ok(all.some((p) => p.id === "pn9"), "the private entry must still be visible to Ching Yee herself");
  assert.ok(all.some((p) => p.id === "pn1"));
});

/* ---------- Management Progress — Ongoing (default tab) ---------- */

test("Management Progress (Ongoing, the default tab) never renders the private pn9 entry's text", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/management");
  const html = sandbox.__appEl.innerHTML;
  assert.doesNotMatch(html, /Personal note/);
  assert.doesNotMatch(html, /not yet ready to raise with management/);
});

test("Ongoing tab's Current Priorities cards show a Latest Progress line sourced from a real, visible Progress Update", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/management");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Latest Progress/);
  // pn7/pn8 (21 Sep) are the newest visible entries for their Matters
  assert.match(html, /Progress Updates &amp; Management Reporting layer specified and build started|Performance management implementation materials drafted for review/);
});

test("the Management Progress tab bar offers Ongoing / Weekly Review / Monthly Review, defaulting to Ongoing", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/management");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Ongoing/);
  assert.match(html, /Weekly Review/);
  assert.match(html, /Monthly Review/);
  // Default tab is Ongoing: Current Priorities (Ongoing-only heading) must be present without switching tabs first.
  assert.match(html, /Current Priorities/);
});

/* ---------- Weekly Review ---------- */

test("Weekly Review never shows the private pn9 entry, even after navigating to the exact week it falls in", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/management");
  sandbox.setMgmtView("weekly");
  sandbox.shiftMgmtWeek(-1); // pn9 is dated 2026-09-20, the week before TODAY's Monday-start week
  const html = sandbox.__appEl.innerHTML;
  assert.doesNotMatch(html, /Personal note/);
  assert.doesNotMatch(html, /not yet ready to raise with management/);
});

test("Weekly Review's default (current) week shows the visible progress entered today (pn7/pn8)", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/management");
  sandbox.setMgmtView("weekly");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Progress This Week/);
  assert.match(html, /Performance management implementation materials drafted for review/);
});

test("computeWeeklyReview() groups deterministically from real records only — no fabricated text", () => {
  const sandbox = loadApp();
  const r = sandbox.computeWeeklyReview(sandbox.TODAY); // TODAY is itself the Monday week-start in this fixture
  for (const u of r.progress) assert.ok(sandbox.VAULT_DATA.PROGRESS_UPDATES.some((p) => p.id === u.id));
  for (const u of r.issues) assert.ok(u.issueRisk, "every issue-line entry must carry real issueRisk text");
});

/* ---------- Monthly Review ---------- */

test("Monthly Review (default month, September 2026 — the month pn9 falls in) never shows the private pn9 entry", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/management");
  sandbox.setMgmtView("monthly");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /September 2026/);
  assert.doesNotMatch(html, /Personal note/);
  assert.doesNotMatch(html, /not yet ready to raise with management/);
});

test("Monthly Review surfaces Major Progress/Milestones, Deliverables Completed, and Outstanding Matters sections", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/management");
  sandbox.setMgmtView("monthly");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Major Progress \/ Milestones/);
  assert.match(html, /Deliverables Completed/);
  assert.match(html, /Outstanding Matters/);
});

/* ---------- Generate Management Update (scope-aware) ---------- */

test("generateUpdateText() defaults to the Ongoing scope and is unchanged from before scope existed", () => {
  const sandbox = loadApp();
  const text = sandbox.generateUpdateText("email");
  assert.match(text, /VT Worldwide/);
  assert.match(text, /MRE Asia/);
  assert.match(text, /Nusantara Project/);
  assert.match(text, /SVE Group Enterprise Platform/);
  assert.match(text, /direction required/i);
});

test("generateUpdateText() never leaks a private entry in any scope", () => {
  const sandbox = loadApp();
  const ongoing = sandbox.generateUpdateText("email", "ongoing");
  const weekly = sandbox.generateUpdateText("email", "weekly");
  const monthly = sandbox.generateUpdateText("email", "monthly");
  for (const text of [ongoing, weekly, monthly]) {
    assert.doesNotMatch(text, /Personal note/);
    assert.doesNotMatch(text, /not yet ready to raise with management/);
  }
});

test("generateUpdateText() weekly/monthly scopes read from the same computeWeeklyReview()/computeMonthlyReview() the tabs render", () => {
  const sandbox = loadApp();
  const weekly = sandbox.generateUpdateText("brief", "weekly");
  assert.match(weekly, /WEEKLY REVIEW/);
  assert.match(weekly, /PROGRESS THIS WEEK/i);
  const monthly = sandbox.generateUpdateText("brief", "monthly");
  assert.match(monthly, /MONTHLY REVIEW/);
});

/* ---------- Progress Updates workspace (Ching Yee's own private view) ---------- */

test("the Progress Updates screen DOES show the private pn9 entry — it is Ching Yee's own view, not Management Progress", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/progress");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Personal note/);
});

test("Progress Updates offers a prominent + Add Progress Update action", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/progress");
  assert.match(sandbox.__appEl.innerHTML, /\+ Add Progress Update/);
});

test("Progress Updates filters by clientId/matterId/workstream/date range/visibility via the URL query", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/progress?visibility=private");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Personal note/); // pn9, private
  assert.doesNotMatch(html, /Nusantara Executive Summary completed/); // pn4, included — excluded by the private-only filter
});

/* ---------- Add / Edit form ---------- */

test("openProgressUpdateForm() opens a new-entry draft preset to a given Matter, mutually exclusive with the other drawers", () => {
  const sandbox = loadApp();
  sandbox.openDocument("d01");
  assert.match(sandbox.__appEl.innerHTML, /drawer open/);
  sandbox.openProgressUpdateForm("matter-mre-opmodel");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /drawer open/);
  assert.match(html, /New Progress Update/);
  assert.doesNotMatch(html, /Lark Digital Acknowledgement/);
});

test("submitProgressUpdate() creates a brand-new record and never overwrites an existing one on the same Matter", () => {
  const sandbox = loadApp();
  const before = sandbox.VAULT_DATA.PROGRESS_UPDATES.length;
  const beforeIds = sandbox.VAULT_DATA.PROGRESS_UPDATES.map((p) => p.id).sort();
  sandbox.openProgressUpdateForm("matter-mre-opmodel");
  sandbox.updateProgressDraftField("text", "A brand-new entry for this Matter.");
  sandbox.submitProgressUpdate();
  const after = sandbox.VAULT_DATA.PROGRESS_UPDATES;
  assert.equal(after.length, before + 1);
  assert.ok(beforeIds.every((id) => after.some((p) => p.id === id)), "no historical entry may be removed or overwritten");
  const created = after.find((p) => p.text === "A brand-new entry for this Matter.");
  assert.ok(created);
  assert.equal(created.matterId, "matter-mre-opmodel");
  assert.ok(created.createdAt && created.updatedAt);
  assert.equal(created.includeInManagementUpdate, false, "Private by default, per the brief's explicit privacy rule");
});

test("submitProgressUpdate() refuses to save without a selected Matter — not every field is mandatory, but a Matter is", () => {
  const sandbox = loadApp();
  const before = sandbox.VAULT_DATA.PROGRESS_UPDATES.length;
  sandbox.openProgressUpdateForm("");
  sandbox.updateProgressDraftField("text", "Orphan entry with no Matter selected.");
  sandbox.submitProgressUpdate();
  assert.equal(sandbox.VAULT_DATA.PROGRESS_UPDATES.length, before);
});

test("updateProgressDraftField() cascades: changing Client clears the drafted Matter and Workstream", () => {
  const sandbox = loadApp();
  sandbox.openProgressUpdateForm("matter-vt-hrtransform");
  sandbox.updateProgressDraftField("workstream", "HR Policy Framework");
  sandbox.updateProgressDraftField("clientId", "mre-asia");
  sandbox.updateProgressDraftField("text", "Cascade check.");
  sandbox.submitProgressUpdate();
  const created = sandbox.VAULT_DATA.PROGRESS_UPDATES.find((p) => p.text === "Cascade check.");
  assert.equal(created, undefined, "matterId was cleared by the Client change, so save must have refused (no Matter selected)");
});

test("openProgressUpdateEditor() edits the live record in place and stamps a new updatedAt, never creating a new record", () => {
  const sandbox = loadApp();
  const before = sandbox.VAULT_DATA.PROGRESS_UPDATES.length;
  sandbox.openProgressUpdateEditor("pn1");
  sandbox.updateProgressUpdateField("pn1", "nextStep", "Edited next step text.");
  assert.equal(sandbox.VAULT_DATA.PROGRESS_UPDATES.length, before);
  const edited = sandbox.VAULT_DATA.PROGRESS_UPDATES.find((p) => p.id === "pn1");
  assert.equal(edited.nextStep, "Edited next step text.");
  assert.ok(edited.updatedAt);
});

test("Recent Movement's progress-update entries open the Progress Update editor, not a bare matter navigation", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/home");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /openProgressUpdateEditor/);
});
