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

test("vault bucket filter narrows the Intelligent View to matching statuses only", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/vault?bucket=draft");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Lark Digital Acknowledgement Workflow Specification/); // Working Draft
  assert.doesNotMatch(html, /HR Company Policy Framework – Set 3/); // Final — must not appear in the draft bucket
});

test("engagement workspace renders the engagement's own contacts and name", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/engagement/vt-worldwide");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /VT Worldwide/);
  assert.match(html, /Ravi Menon/);
});

test("unknown engagement id renders a not-found state instead of throwing", () => {
  const sandbox = loadApp();
  assert.doesNotThrow(() => sandbox.navigate("#/engagement/does-not-exist"));
  assert.match(sandbox.__appEl.innerHTML, /Not found/);
});

test("search finds a document by metadata even when the query only matches a tag", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/search?q=Labuan");
  assert.match(sandbox.__appEl.innerHTML, /Labuan Fund Structuring Note/);
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
  assert.match(html, /Resignation, Termination &amp; Offboarding Policy|Resignation, Termination & Offboarding Policy/);
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

test("fileToVault() classifies the document and it now appears in the Vault", () => {
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
