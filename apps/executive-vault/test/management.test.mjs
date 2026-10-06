import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./loadApp.mjs";

test("only management-visible, non-legacy Matters appear in managementVisibleMatters()", () => {
  const sandbox = loadApp();
  const { MATTERS } = sandbox.VAULT_DATA;
  const visible = sandbox.managementVisibleMatters();
  const expectedIds = MATTERS.filter((m) => m.managementVisible).map((m) => m.id).sort();
  assert.deepEqual(visible.map((m) => m.id).sort(), expectedIds);
  assert.ok(visible.length === 5, "fixture should expose exactly the five current management-visible workstreams (as at 6 Oct 2026)");
  assert.ok(!visible.some((m) => m.id === "matter-legacy-resort"), "the legacy Matter must never be management-visible even if flagged");
});

test("Internal Governance's litigation Matter stays NOT management-visible even though its Governance Pack policy Matter is now explicitly opted in (privacy demonstrated, not just declared)", () => {
  const sandbox = loadApp();
  const visible = sandbox.managementVisibleMatters().map((m) => m.id);
  assert.ok(visible.includes("matter-intgov-policy"), "SVE – Governance Pack is one of the five current management-visible workstreams (6 Oct 2026)");
  assert.ok(!visible.includes("matter-intgov-litigation"), "opting one Internal Governance Matter in never implies its sibling litigation Matter follows");
});

test("Management Progress page never renders Legacy, litigation, or unrelated internal material", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/management");
  const html = sandbox.__appEl.innerHTML;
  assert.doesNotMatch(html, /Sabah/);
  assert.doesNotMatch(html, /Litigation Strategy Call/);
  assert.doesNotMatch(html, /Vendor XYZ/);
  assert.doesNotMatch(html, /External Counsel/);
  // "Business Continuity Plan" is task t5's own title — hidden because t5 itself
  // is managementVisible:false, independent of its Matter (matter-intgov-policy)
  // now being visible as the Governance Pack. Task-level privacy still holds even
  // once the parent Matter is opted in.
  assert.doesNotMatch(html, /Business Continuity Plan/);
});

test("Management Progress shows exactly the five current management-visible Matters as Current Priorities, with real content from the actual Matter records (as at 6 Oct 2026)", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/management");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /VT Worldwide/);
  assert.match(html, /Policy & Documentation Close-Out/);
  assert.match(html, /Nusantara Project/);
  assert.match(html, /Document Master Registry Finalisation/);
  assert.match(html, /Internal Governance/);
  assert.match(html, /SVE – Governance Pack \(HR & Company Policies\)/);
  assert.match(html, /PQCAL/);
  assert.match(html, /Shared Administration/);
  assert.match(html, /CY – Appraisal/);
  assert.match(html, /release outstanding documents and close out the handover/); // real VT Worldwide nextStep text, not a copy
  assert.doesNotMatch(html, /MRE Asia/); // no longer management-visible
  assert.doesNotMatch(html, /SVE Group Enterprise Platform/); // no longer management-visible
});

test("Management Attention lists only Matters with a non-null managementAttentionLevel — VT Worldwide and the SVE Governance Pack, both 'For Review' as at 6 Oct 2026", () => {
  const sandbox = loadApp();
  const attention = sandbox.managementVisibleMatters().filter((m) => m.managementAttentionLevel);
  assert.equal(attention.length, 2);
  assert.ok(attention.some((m) => m.id === "matter-intgov-policy"));
  assert.ok(attention.some((m) => m.id === "matter-vt-hrtransform"));
  for (const m of attention) assert.equal(m.managementAttentionLevel, "For Review");
  sandbox.navigate("#/management");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /For Review/i);
  assert.match(html, /Final walkthrough with Eric before release \/ close-out/i);
  assert.match(html, /Governance Pack to be presented for Management review once final harmonisation is completed/i);
});

test("managementVisibleDocs() excludes documents with managementVisibility None (the default) and excludes Legacy", () => {
  const sandbox = loadApp();
  const { DOCUMENTS } = sandbox.VAULT_DATA;
  const visible = sandbox.managementVisibleDocs();
  for (const d of visible) {
    assert.notEqual(d.managementVisibility || "None", "None");
  }
  // an ordinary document with no managementVisibility field at all must not leak in
  const ordinary = DOCUMENTS.find((d) => d.id === "d01");
  assert.ok(!visible.some((d) => d.id === "d01"));
  // the litigation resolution has no managementVisibility set and its matter isn't visible either
  assert.ok(!visible.some((d) => d.id === "d17d"));
});

test("Supporting Documents section resolves to real Vault documents, opening the same Document Detail drawer", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/management");
  // d12 (SVE Group Enterprise Platform — Management Review) no longer qualifies:
  // its Matter (matter-svegip-platform) is no longer management-visible. d19d
  // (VT Worldwide) is now the live example of a management-visible document.
  assert.match(sandbox.__appEl.innerHTML, /Policy Closure Summary/);
  sandbox.openDocument("d19d");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /drawer open/);
  assert.match(html, /Policy Closure Summary/);
});

test("Decisions / Direction Required reuses computeDecisionsRequired() and applies visibility on top — currently empty, since the one qualifying decision document (d12) belongs to a Matter that is no longer management-visible", () => {
  const sandbox = loadApp();
  const decisions = sandbox.computeManagementDecisions();
  const base = sandbox.computeDecisionsRequired();
  for (const d of decisions) assert.ok(base.includes(d), "every management decision must come from the same base decision computation");
  assert.equal(decisions.length, 0);
  assert.ok(!decisions.some((d) => d.id === "d12")); // SVE Group Enterprise Platform — no longer management-visible
  assert.ok(!decisions.some((d) => d.id === "d17d")); // litigation resolution stays private
  sandbox.navigate("#/management");
  assert.match(sandbox.__appEl.innerHTML, /Nothing currently pending a decision/); // graceful empty state, not a broken section
});

test("decisionDisplayStatus() derives Pending/Decided/Superseded from the document's existing Status field", () => {
  const sandbox = loadApp();
  const pendingDoc = sandbox.getDocument("d12"); // Internal Review
  assert.equal(sandbox.decisionDisplayStatus(pendingDoc), "Pending");
  const finalDoc = sandbox.getDocument("d14b"); // Final resolution
  assert.equal(sandbox.decisionDisplayStatus(finalDoc), "Decided");
});

test("Waiting On reuses the existing waitingOn Task model and requires managementVisible:true on BOTH the task and its Matter", () => {
  const sandbox = loadApp();
  const waiting = sandbox.managementWaitingOn();
  assert.ok(waiting.every((t) => t.waitingOn && t.managementVisible));
  assert.equal(waiting.length, 1);
  assert.ok(waiting.some((t) => t.id === "t3")); // Ravi Menon — the only task whose Matter is currently management-visible
  assert.ok(!waiting.some((t) => t.id === "t7")); // litigation waiting-on stays private (matter not visible)
  assert.ok(!waiting.some((t) => t.id === "t8")); // MRE workforce info — matter-mre-opmodel is no longer management-visible, even though the task itself is still flagged managementVisible:true
});

test("Progress Since Last Update only shows notes with includeInManagementUpdate:true, for visible Matters", () => {
  const sandbox = loadApp();
  const notes = sandbox.managementProgressNotes();
  assert.ok(notes.every((n) => n.includeInManagementUpdate));
  assert.ok(notes.some((n) => n.text === "VT policy revisions completed"));
  assert.ok(!notes.some((n) => n.text === "Internal admin filing cleanup completed"), "excluded note (includeInManagementUpdate:false) must not appear");
});

test("computeManagementSummary() counts are fully derived and match the fixture (as at 6 Oct 2026 — five In Progress workstreams, none Awaiting Input or Decision Required)", () => {
  const sandbox = loadApp();
  const s = sandbox.computeManagementSummary();
  assert.equal(s.activeMatters, 5);
  assert.equal(s.awaitingInput, 0);
  assert.equal(s.decisionRequired, 0);
  assert.equal(s.forReview, sandbox.computeManagementDecisions().length);
});

test("Generate Management Update produces editable text mentioning every visible Matter, with no send action anywhere", () => {
  const sandbox = loadApp();
  const text = sandbox.generateUpdateText("email");
  assert.match(text, /VT Worldwide/);
  assert.match(text, /Nusantara Project/);
  assert.match(text, /Internal Governance/);
  assert.match(text, /PQCAL/);
  assert.match(text, /CY – Appraisal/);
  assert.match(text, /for review/i); // Management attention section — VT Worldwide and the Governance Pack
  assert.doesNotMatch(text, /MRE Asia/); // no longer management-visible
  assert.doesNotMatch(text, /SVE Group Enterprise Platform/); // no longer management-visible
  sandbox.navigate("#/management");
  sandbox.toggleGenerateUpdate();
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /<textarea/);
  assert.doesNotMatch(html, /Send Email|Send WhatsApp|mailto:/i);
});

test("updateMatterField() mutates the existing Matter record in place — no new record is created", () => {
  const sandbox = loadApp();
  const before = sandbox.VAULT_DATA.MATTERS.length;
  sandbox.updateMatterField("matter-mre-opmodel", "currentPosition", "Updated position text.");
  assert.equal(sandbox.VAULT_DATA.MATTERS.length, before);
  assert.equal(sandbox.getMatter("matter-mre-opmodel").currentPosition, "Updated position text.");
  assert.equal(sandbox.getMatter("matter-mre-opmodel").managementUpdated, sandbox.TODAY);
});

test("updateMatterField() can toggle managementVisible, immediately changing what Management Progress shows", () => {
  const sandbox = loadApp();
  assert.ok(!sandbox.managementVisibleMatters().some((m) => m.id === "matter-mre-opmodel"));
  sandbox.updateMatterField("matter-mre-opmodel", "managementVisible", true);
  assert.ok(sandbox.managementVisibleMatters().some((m) => m.id === "matter-mre-opmodel"));
});

test("opening the Matter management editor is mutually exclusive with the Document and Meeting drawers", () => {
  const sandbox = loadApp();
  sandbox.openDocument("d01");
  assert.match(sandbox.__appEl.innerHTML, /drawer open/);
  sandbox.openMatterEditor("matter-vt-hrtransform");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /drawer open/);
  assert.match(html, /Management Snapshot/);
  assert.doesNotMatch(html, /Lark Digital Acknowledgement/);
});

test("the Preview banner offers an explicit Exit Preview control back to Executive Home", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/management");
  assert.match(sandbox.__appEl.innerHTML, /Exit Preview/);
});

test("unclassified Inbox items and personal working files never appear on Management Progress", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/management");
  const html = sandbox.__appEl.innerHTML;
  assert.doesNotMatch(html, /Scan_2026-09-19\.pdf/);
  assert.doesNotMatch(html, /IMG_Board_Pack_Sept\.pdf/);
});

test("a management-visible Matter shows a subtle 'Management Visible' indicator in its Client Workspace, so the account holder never has to open Management Progress to check", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/client/vt-worldwide"); // owns matter-vt-hrtransform, managementVisible:true
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Management Visible/);
});

test("a Matter NOT management-visible shows no such indicator", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/client/mre-asia"); // owns matter-mre-opmodel, managementVisible:false
  const html = sandbox.__appEl.innerHTML;
  assert.doesNotMatch(html, /Management Visible/);
});

test("the Projects / Matters register also shows the 'Management Visible' indicator for visible Matters only", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/matters");
  const html = sandbox.__appEl.innerHTML;
  const visibleCount = (html.match(/Management Visible/g) || []).length;
  // The register renders both the desktop table and the mobile record-card
  // list at once (CSS toggles which is visible per breakpoint — see
  // .desktop-register/.record-list in styles.css) — one match per matter
  // in each representation.
  assert.equal(visibleCount, sandbox.managementVisibleMatters().length * 2);
});

test("a management-visible document shows a subtle 'Management: <level>' indicator on its own Document Detail drawer", () => {
  const sandbox = loadApp();
  sandbox.openDocument("d12"); // managementVisibility: "For Review"
  assert.match(sandbox.__appEl.innerHTML, /Management: For Review/);
  sandbox.openDocument("d01"); // no managementVisibility set at all
  assert.doesNotMatch(sandbox.__appEl.innerHTML, /Management: /);
});
