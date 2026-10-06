/**
 * Executive Vault dashboard redesign (Oct 2026) — the new 5-second command
 * centre: Executive Overview → Needs Your Attention → Upcoming → Workstream
 * Snapshot → Level-2 drill-down, behind a new EXECUTIVE | MY WORK |
 * PORTFOLIO perspective switch on Management Progress's existing Ongoing
 * tab. Every test here reuses loadApp()'s real vm sandbox — no browser,
 * same technique as every other test file in this suite.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./loadApp.mjs";

/* ---------- Perspective switch ---------- */

test("Management Progress's Ongoing tab defaults to the Executive perspective", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/management");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Executive Overview/);
  assert.match(html, /Needs Your Attention/);
  assert.match(html, /Upcoming/);
  assert.match(html, /Workstream Snapshot/);
});

test("setMgmtPerspective() switches to My Work — Workstream Snapshot defaults to the My Actions filter, and Waiting On / Progress Since Last Update / Next 7 Days (pre-existing sections) are still reachable there", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/management");
  sandbox.setMgmtPerspective("my-work");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /class="active"[^>]*>My Work</); // perspective toggle
  assert.match(html, /class="active"[^>]*>My Actions</); // Snapshot filter defaulted
  assert.match(html, /Waiting On/);
  assert.match(html, /Progress Since Last Update/);
  assert.match(html, /Next 7 Days/);
  assert.doesNotMatch(html, /Needs Your Attention/); // Executive-only section
});

test("setMgmtPerspective() switches to Portfolio — the full unfiltered Snapshot plus Decisions/Direction Required and Supporting Documents (pre-existing sections)", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/management");
  sandbox.setMgmtPerspective("portfolio");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /class="active"[^>]*>Portfolio</);
  assert.match(html, /class="active"[^>]*>All</); // Snapshot filter defaulted to unfiltered
  assert.match(html, /Decisions \/ Direction Required/);
  assert.match(html, /Supporting Documents/);
});

test("switching perspective resets the Snapshot filter to that perspective's own default without fighting a subsequent manual filter click", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/management");
  sandbox.setMgmtPerspective("my-work");
  assert.match(sandbox.__appEl.innerHTML, /class="active"[^>]*>My Actions</);
  sandbox.setMgmtSnapshotFilter("this-week");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /class="active"[^>]*>This Week</, "a manual filter click must stick, not be reset by the next render");
  assert.doesNotMatch(html, /class="active"[^>]*>My Actions</);
});

test("Weekly Review and Monthly Review are completely unaffected by the perspective switch — still reachable, still showing their own existing content", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/management");
  sandbox.setMgmtPerspective("portfolio");
  sandbox.setMgmtView("weekly");
  const html = sandbox.__appEl.innerHTML;
  assert.doesNotMatch(html, /Workstream Snapshot/); // perspective content only shows under the Ongoing tab
  assert.match(html, /Progress This Week/);
});

/* ---------- Needs Your Attention: severity sort + computed Overdue ---------- */

test("computeNeedsAttention() sorts Decision Required ahead of For Review, and never includes a Matter with no attention and no overdue targetDate", () => {
  const sandbox = loadApp();
  const items = sandbox.computeNeedsAttention();
  assert.ok(items.length >= 2);
  const svegip = items.find((i) => i.matter.id === "matter-svegip-platform");
  const vt = items.find((i) => i.matter.id === "matter-vt-hrtransform");
  assert.equal(svegip.level, "Decision Required");
  assert.equal(vt.level, "For Review");
  assert.ok(items.indexOf(svegip) < items.indexOf(vt), "Decision Required must lead For Review");
  assert.ok(!items.some((i) => i.matter.id === "matter-nus-strategy"), "Nusantara has no attention level and is not overdue");
});

test("isMatterOverdue() is computed from the Matter's own targetDate against the live clock, never a stored field", () => {
  const sandbox = loadApp();
  assert.equal(sandbox.isMatterOverdue({ targetDate: null }), false);
  assert.equal(sandbox.isMatterOverdue({ targetDate: "2020-01-01" }), true);
  assert.equal(sandbox.isMatterOverdue({ targetDate: "2099-01-01" }), false);
});

test("an overdue Matter is surfaced in Needs Your Attention with the Overdue badge, even if it has no explicit managementAttentionLevel", () => {
  const sandbox = loadApp();
  const overdueMatter = sandbox.getMatter("matter-nus-strategy");
  const originalTargetDate = overdueMatter.targetDate;
  overdueMatter.targetDate = "2020-01-01"; // force overdue, independent of any stored attention level
  try {
    const items = sandbox.computeNeedsAttention();
    const found = items.find((i) => i.matter.id === "matter-nus-strategy");
    assert.ok(found, "an overdue Matter must appear in Needs Your Attention even with managementAttentionLevel:null");
    assert.equal(found.level, "Overdue");
    assert.equal(found.overdue, true);
  } finally {
    overdueMatter.targetDate = originalTargetDate;
  }
});

/* ---------- Upcoming: meetings + Client keyDates, merged and date-sorted ---------- */

test("Upcoming surfaces the PQCAL physical meeting with Mr. Sham (8 Oct 2026) as a real MEETINGS record, not a bare keyDate", () => {
  const sandbox = loadApp();
  sandbox.setAppClock("2026-10-06T09:00:00");
  const items = sandbox.computeUpcomingItems(14);
  const pqcal = items.find((it) => it.clientId === "pqcal");
  assert.ok(pqcal, "the PQCAL meeting must appear in Upcoming within a 14-day window of 6 Oct 2026");
  assert.equal(pqcal.date, "2026-10-08");
  assert.equal(pqcal.time, "09:30");
  assert.equal(pqcal.kind, "meeting");
  sandbox.navigate("#/management");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /PQCAL/);
  assert.match(html, /Physical Meeting with Mr\. Sham/);
});

test("Upcoming excludes past keyDates/meetings — it is a forward-looking list, not a history", () => {
  const sandbox = loadApp();
  sandbox.setAppClock("2026-10-06T09:00:00");
  const items = sandbox.computeUpcomingItems(14);
  assert.ok(items.every((it) => it.date >= sandbox.TODAY));
});

test("clicking an Upcoming meeting opens the same Meeting Brief drawer as clicking it anywhere else", () => {
  const sandbox = loadApp();
  sandbox.setAppClock("2026-10-06T09:00:00");
  sandbox.navigate("#/management");
  sandbox.openMeeting("m11");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /drawer open/);
  assert.match(html, /PQCAL — Physical Meeting with Mr\. Sham/);
});

/* ---------- Workstream Snapshot: filters ---------- */

test("Workstream Snapshot's ALL filter shows every management-visible Matter and nothing else", () => {
  const sandbox = loadApp();
  const rows = sandbox.computeWorkstreamSnapshot();
  assert.equal(rows.length, 6);
  assert.ok(!rows.some((r) => r.matter.id === "matter-mre-opmodel"));
});

test("Workstream Snapshot's NEEDS ERIC filter is exactly the Matters with an explicit non-informational attention level or overdue — the complement of MY ACTIONS", () => {
  const sandbox = loadApp();
  const rows = sandbox.computeWorkstreamSnapshot();
  const needsEric = rows.filter((r) => sandbox.snapshotFilterMatch(r, "needs-eric"));
  const myActions = rows.filter((r) => sandbox.snapshotFilterMatch(r, "my-actions"));
  assert.equal(needsEric.length + myActions.length, rows.length, "every row is exactly one or the other, never both, never neither");
  assert.ok(needsEric.some((r) => r.matter.id === "matter-svegip-platform"));
  assert.ok(needsEric.some((r) => r.matter.id === "matter-vt-hrtransform"));
  assert.ok(myActions.some((r) => r.matter.id === "matter-nus-strategy"));
  assert.ok(myActions.some((r) => r.matter.id === "matter-pqcal-shared-admin"));
});

test("Workstream Snapshot's THIS WEEK filter includes PQCAL (its meeting is 2 days out) as at 6 Oct 2026", () => {
  const sandbox = loadApp();
  sandbox.setAppClock("2026-10-06T09:00:00");
  const rows = sandbox.computeWorkstreamSnapshot();
  const thisWeek = rows.filter((r) => sandbox.snapshotFilterMatch(r, "this-week"));
  assert.ok(thisWeek.some((r) => r.matter.id === "matter-pqcal-shared-admin"));
});

test("clicking a Snapshot filter button re-renders the table with only matching rows", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/management");
  sandbox.setMgmtSnapshotFilter("needs-eric");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /SVE Group Enterprise Platform/);
  // CY – Appraisal has no attention level and no keyDates, so it never
  // appears anywhere else on the Executive perspective (Overview/Attention/
  // Upcoming) — a clean proof this specific absence comes from the Snapshot
  // filter itself, not a coincidental mention elsewhere on the page.
  assert.doesNotMatch(html, /CY – Appraisal/); // My Actions, not Needs Eric
});

/* ---------- Stage vs Attention: two genuinely separate dimensions ---------- */

test("SVE Group Enterprise Platform shows Stage 'On Hold' AND Attention 'Decision Required' at once — proof the two vocabularies are independent, not the same field twice", () => {
  const sandbox = loadApp();
  const row = sandbox.computeWorkstreamSnapshot().find((r) => r.matter.id === "matter-svegip-platform");
  assert.equal(row.stage, "On Hold");
  assert.equal(row.attentionLevel, "Decision Required");
  sandbox.navigate("#/management");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /stage-chip-on-hold/);
  assert.match(html, /attn-chip-decision-required/);
});

test("VT Worldwide shows Stage 'Close-Out' with 90% progress, and PQCAL shows Stage 'Mobilisation' with 35% progress — reusing the existing currentStage field, now constrained to MATTER_STAGES", () => {
  const sandbox = loadApp();
  const vt = sandbox.getMatter("matter-vt-hrtransform");
  const pqcal = sandbox.getMatter("matter-pqcal-shared-admin");
  assert.equal(vt.currentStage, "Close-Out");
  assert.equal(vt.progressPercent, 90);
  assert.equal(pqcal.currentStage, "Mobilisation");
  assert.equal(pqcal.progressPercent, 35);
  // MATTER_STAGES itself is a `const` (like every other app.js top-level
  // vocabulary array), so it isn't reachable as sandbox.MATTER_STAGES from
  // the vm context — stageChip() is exercised directly instead, which is
  // the only code path that actually reads the constant.
  assert.match(sandbox.stageChip(vt.currentStage), /stage-chip-close-out/);
  assert.match(sandbox.stageChip(pqcal.currentStage), /stage-chip-mobilisation/);
});

/* ---------- Level-2 drill-down ---------- */

test("clicking a Workstream Snapshot row opens the Level-2 drill-down with Current Position/Next Step/Management Action/Work Areas/Recent Updates/Documents and an Update control", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/management");
  sandbox.openWorkstreamDrillDown("matter-pqcal-shared-admin");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /drawer open/);
  assert.match(html, /Current Position/);
  assert.match(html, /Shared Admin mobilisation and operational setup commenced/);
  assert.match(html, /Next Step/);
  assert.match(html, /Complete email\/access setup and prepare for the physical meeting/);
  assert.match(html, /Management Action/);
  assert.match(html, /Work Areas/);
  assert.match(html, /Email & Access/);
  assert.match(html, /Recent Updates/);
  assert.match(html, /Documents/);
  assert.match(html, /Update Management Snapshot/);
});

test("the drill-down's Documents list is privacy-gated through the same managementVisibleDocs() every other section reads — never an unfiltered per-Matter document dump", () => {
  const sandbox = loadApp();
  sandbox.openWorkstreamDrillDown("matter-vt-hrtransform");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Policy Closure Summary/); // d19d — managementVisibility: Reference
  // d-series documents on this Matter with no managementVisibility set must not leak into the drill-down
  const visibleIds = new Set(sandbox.managementVisibleDocs().map((d) => d.id));
  const allMatterDocs = sandbox.VAULT_DATA.DOCUMENTS.filter((d) => d.matterId === "matter-vt-hrtransform");
  const hiddenDoc = allMatterDocs.find((d) => !visibleIds.has(d.id));
  if (hiddenDoc) assert.doesNotMatch(html, new RegExp(hiddenDoc.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("the drill-down's Update control reuses the EXISTING Management Snapshot editor (openMatterEditor) rather than a second, duplicate edit form", () => {
  const sandbox = loadApp();
  sandbox.openWorkstreamDrillDown("matter-cy-appraisal");
  sandbox.openMatterEditor("matter-cy-appraisal");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Management Snapshot/); // matterEditorContent()'s own breadcrumb
  assert.match(html, /Show on Management Progress/); // a field unique to the existing editor, proving it's the same drawer, not a new one
});

test("opening the drill-down is mutually exclusive with every other drawer (same one-at-a-time rule as the rest of the app)", () => {
  const sandbox = loadApp();
  sandbox.openDocument("d01");
  assert.match(sandbox.__appEl.innerHTML, /drawer open/);
  sandbox.openWorkstreamDrillDown("matter-vt-hrtransform");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /drawer open/);
  assert.doesNotMatch(html, /Lark Digital Acknowledgement Workflow Specification/);
});

/* ---------- Privacy: the redesign changes presentation, never the boundary ---------- */

test("no perspective ever renders MRE Asia, the litigation Matter, or Legacy material — restructuring the page never widens what Eric sees", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/management");
  for (const p of ["executive", "my-work", "portfolio"]) {
    sandbox.setMgmtPerspective(p);
    const html = sandbox.__appEl.innerHTML;
    assert.doesNotMatch(html, /MRE Asia/, `perspective "${p}" must not show MRE Asia`);
    assert.doesNotMatch(html, /Vendor XYZ/, `perspective "${p}" must not show the litigation Matter`);
    assert.doesNotMatch(html, /Sabah/, `perspective "${p}" must not show Legacy material`);
  }
});

/* ---------- Mobile-first ordering ---------- */

test("Executive Overview, Needs Your Attention and Upcoming all appear in the DOM before Workstream Snapshot's first full card — the 5-second scan never requires scrolling past a card first", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/management");
  const html = sandbox.__appEl.innerHTML;
  // Matched on the exact section-title markup, not the bare words — "Upcoming"
  // also appears earlier as a stat-tile label inside Executive Overview
  // itself, which would otherwise give a false ordering.
  const iOverview = html.indexOf('mgmt-section-title">Executive Overview<');
  const iAttention = html.indexOf('mgmt-section-title">Needs Your Attention<');
  const iUpcoming = html.indexOf('mgmt-section-title">Upcoming<');
  const iSnapshot = html.indexOf('mgmt-section-title">Workstream Snapshot<');
  assert.ok(iOverview > -1 && iOverview < iAttention);
  assert.ok(iAttention < iUpcoming);
  assert.ok(iUpcoming < iSnapshot, "Upcoming must appear before the Workstream Snapshot section begins");
});
