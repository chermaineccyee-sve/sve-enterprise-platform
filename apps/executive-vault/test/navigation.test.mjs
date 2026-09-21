import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./loadApp.mjs";

test("loads directly onto Executive Home", () => {
  const sandbox = loadApp();
  assert.match(sandbox.__appEl.innerHTML, /Executive Home/);
});

test("navigate() switches the rendered screen", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/vault");
  assert.match(sandbox.__appEl.innerHTML, /My Document Vault/);
  sandbox.navigate("#/clients");
  assert.match(sandbox.__appEl.innerHTML, /VT Worldwide/);
  assert.match(sandbox.__appEl.innerHTML, /MRE Asia/);
});

test("the Legacy client never appears in the Clients & Engagements / Projects & Programmes lists", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/clients");
  assert.doesNotMatch(sandbox.__appEl.innerHTML, /Sabah/);
  sandbox.navigate("#/projects");
  assert.doesNotMatch(sandbox.__appEl.innerHTML, /Sabah/);
});

test("vault bucket filter narrows the Intelligent View to matching statuses only", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/vault?bucket=draft");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Lark Digital Acknowledgement Workflow Specification/); // Working Draft
  assert.doesNotMatch(html, /HR Company Policy Framework – Set 3/); // Final — must not appear in the draft bucket
});

test("the Vault's default view never shows Legacy business-line documents", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/vault");
  assert.doesNotMatch(sandbox.__appEl.innerHTML, /Sabah Resort Development Master Plan/);
});

test("client workspace renders the client's own contacts, name, and Engagement/Matter/Workstream structure", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/client/vt-worldwide");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /VT Worldwide/);
  assert.match(html, /Ravi Menon/);
  assert.match(html, /HR Transformation \/ HR Advisory/); // Engagement name
  assert.match(html, /HR Digitalisation \/ HRMS/); // Workstream name
});

test("the Legacy client's workspace still renders directly (findable on purpose) with a Legacy callout", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/client/legacy-sabah-resort");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Sabah/);
  assert.match(html, /Legacy business line/);
});

test("unknown client id renders a not-found state instead of throwing", () => {
  const sandbox = loadApp();
  assert.doesNotThrow(() => sandbox.navigate("#/client/does-not-exist"));
  assert.match(sandbox.__appEl.innerHTML, /Not found/);
});

test("search finds a document by metadata even when the query only matches a tag", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/search?q=Labuan");
  assert.match(sandbox.__appEl.innerHTML, /Labuan Fund Structuring Note/);
});

test("search excludes Legacy documents by default, and includes them with the Legacy toggle", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/search?q=Sabah");
  assert.doesNotMatch(sandbox.__appEl.innerHTML, /Sabah Resort Development Master Plan/);
  sandbox.navigate("#/search?q=Sabah&legacy=1");
  assert.match(sandbox.__appEl.innerHTML, /Sabah Resort Development Master Plan/);
});

test("search with no query shows the empty prompt, not an empty result list silently", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/search");
  assert.match(sandbox.__appEl.innerHTML, /Nothing to show yet/);
});

test("openDocument() opens the drawer with that document's title", () => {
  const sandbox = loadApp();
  sandbox.openDocument("d02");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /drawer open/);
  assert.match(html, /Resignation, Termination & Offboarding Policy/);
});

test("closeDrawer() removes the open drawer state", () => {
  const sandbox = loadApp();
  sandbox.openDocument("d02");
  sandbox.closeDrawer();
  assert.doesNotMatch(sandbox.__appEl.innerHTML, /drawer open/);
});

test("an unclassified document's drawer offers File to Vault, not Archive", () => {
  const sandbox = loadApp();
  sandbox.openDocument("d24");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /File to Vault/);
});

test("fileToVault() classifies the document and it disappears from the Inbox's unclassified list", () => {
  const sandbox = loadApp();
  const before = sandbox.VAULT_DATA.DOCUMENTS.find((d) => d.id === "d25");
  assert.equal(before.classified, false);
  sandbox.fileToVault("d25");
  const after = sandbox.VAULT_DATA.DOCUMENTS.find((d) => d.id === "d25");
  assert.equal(after.classified, true);
  assert.ok(!sandbox.computeAttention().unclassified.some((d) => d.id === "d25"), "d25 should no longer be in the Inbox's unclassified list");
});

test("toggleStar() flips the in-memory starred flag", () => {
  const sandbox = loadApp();
  const doc = sandbox.VAULT_DATA.DOCUMENTS.find((d) => d.id === "d10");
  const wasStarred = doc.starred;
  sandbox.toggleStar("d10");
  assert.equal(sandbox.VAULT_DATA.DOCUMENTS.find((d) => d.id === "d10").starred, !wasStarred);
});

test("archiving a document moves it into the Archive screen and out of the active vault bucket", () => {
  const sandbox = loadApp();
  sandbox.archiveDocument("d13");
  assert.equal(sandbox.getDocument("d13").status, "Archived");
  sandbox.navigate("#/archive");
  assert.match(sandbox.__appEl.innerHTML, /Enterprise Architecture Briefing Notes/);
});

test("updateDocField clears matterId and workstream when the client changes (cascading reset)", () => {
  const sandbox = loadApp();
  const doc = sandbox.getDocument("d01");
  assert.equal(doc.clientId, "vt-worldwide");
  assert.ok(doc.matterId);
  sandbox.updateDocField("d01", "clientId", "mre-asia");
  const updated = sandbox.getDocument("d01");
  assert.equal(updated.clientId, "mre-asia");
  assert.equal(updated.matterId, null);
  assert.equal(updated.workstream, null);
});

test("promoteWorkstreamToMatter() creates a new Matter and reassigns that workstream's documents to it", () => {
  const sandbox = loadApp();
  const sourceMatterId = "matter-vt-hrtransform";
  const before = sandbox.getDocument("d01"); // HR-124, workstream "HR Digitalisation / HRMS"
  assert.equal(before.matterId, sourceMatterId);
  assert.equal(before.workstream, "HR Digitalisation / HRMS");

  sandbox.promoteWorkstreamToMatter(sourceMatterId, "HR Digitalisation / HRMS");

  const after = sandbox.getDocument("d01");
  assert.notEqual(after.matterId, sourceMatterId);
  assert.equal(after.workstream, null);
  const newMatter = sandbox.getMatter(after.matterId);
  assert.ok(newMatter);
  assert.equal(newMatter.name, "HR Digitalisation / HRMS");
  assert.equal(newMatter.engagementId, "eng-vt-hr");

  const sourceMatter = sandbox.getMatter(sourceMatterId);
  assert.ok(!sourceMatter.workstreams.includes("HR Digitalisation / HRMS"), "the promoted workstream should be removed from the source matter's list");

  // the other VT-worldwide documents on a different workstream under the
  // same source matter must NOT have moved
  const stillThere = sandbox.getDocument("d02"); // HR-025, workstream "HR Policy Framework"
  assert.equal(stillThere.matterId, sourceMatterId);
});
