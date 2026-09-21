import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./loadApp.mjs";

function activeDocs(sandbox) {
  const { CLIENTS, DOCUMENTS } = sandbox.VAULT_DATA;
  const legacyIds = new Set(CLIENTS.filter((c) => c.legacy).map((c) => c.id));
  return DOCUMENTS.filter((d) => d.classified && !legacyIds.has(d.clientId));
}

test("computeAttention()'s unclassified list matches exactly the documents with classified:false", () => {
  const sandbox = loadApp();
  const { DOCUMENTS } = sandbox.VAULT_DATA;
  const expected = DOCUMENTS.filter((d) => !d.classified).map((d) => d.id).sort();
  const actual = sandbox.computeAttention().unclassified.map((d) => d.id).sort();
  assert.deepEqual(actual, expected);
});

test("computeAttention()'s duplicates list matches exactly the (non-legacy) documents flagged possibleDuplicateOf", () => {
  const sandbox = loadApp();
  const expected = activeDocs(sandbox).filter((d) => d.possibleDuplicateOf).map((d) => d.id).sort();
  const actual = sandbox.computeAttention().duplicates.map((d) => d.id).sort();
  assert.deepEqual(actual, expected);
});

test("computeAttention()'s confidentialFlagged list is exactly the Highly Confidential, non-legacy classified documents", () => {
  const sandbox = loadApp();
  const expected = activeDocs(sandbox).filter((d) => d.confidentiality === "highly-confidential").map((d) => d.id).sort();
  const actual = sandbox.computeAttention().confidentialFlagged.map((d) => d.id).sort();
  assert.deepEqual(actual, expected);
});

test("computeAttention() and Executive Home dashboard counts exclude Legacy business-line documents entirely", () => {
  const sandbox = loadApp();
  const a = sandbox.computeAttention();
  const allFlagged = [].concat(a.awaitingReview, a.duplicates, a.staleDrafts, a.missingVersion, a.confidentialFlagged);
  for (const d of allFlagged) {
    const client = sandbox.getClient(d.clientId);
    assert.ok(!client || !client.legacy, `${d.id} belongs to a Legacy client and must not appear in Attention Required`);
  }
  sandbox.navigate("#/home");
  assert.doesNotMatch(sandbox.__appEl.innerHTML, /Sabah/);
});

test("computeAttention()'s followUps list is exactly the not-done, not-waiting-on-someone-else tasks", () => {
  const sandbox = loadApp();
  const { TASKS } = sandbox.VAULT_DATA;
  const expected = TASKS.filter((t) => !t.done && !t.waitingOn).map((t) => t.id).sort();
  const actual = sandbox.computeAttention().followUps.map((t) => t.id).sort();
  assert.deepEqual(actual, expected);
});

test("computeAttention()'s waitingOn list is exactly the not-done tasks with a waitingOn name set", () => {
  const sandbox = loadApp();
  const { TASKS } = sandbox.VAULT_DATA;
  const expected = TASKS.filter((t) => !t.done && t.waitingOn).map((t) => t.id).sort();
  const actual = sandbox.computeAttention().waitingOn.map((t) => t.id).sort();
  assert.deepEqual(actual, expected);
  assert.ok(expected.length > 0, "fixture should include at least one waiting-on-others task");
});

test("marking every task done empties both followUps and waitingOn", () => {
  const sandbox = loadApp();
  sandbox.VAULT_DATA.TASKS.forEach((t) => { if (!t.done) sandbox.toggleTask(t.id); });
  assert.equal(sandbox.computeAttention().followUps.length, 0);
  assert.equal(sandbox.computeAttention().waitingOn.length, 0);
});

test("computeDecisionsRequired() returns only Resolution/Management Paper documents not yet Final/closed", () => {
  const sandbox = loadApp();
  const decisions = sandbox.computeDecisionsRequired();
  assert.ok(decisions.length > 0, "fixture should include at least one pending decision document");
  for (const d of decisions) {
    assert.ok(["Resolution", "Management Paper"].includes(d.docType), `${d.id} has docType "${d.docType}", not a decision-shaped type`);
    assert.ok(!["Final", "Issued", "Approved", "Superseded", "Archived"].includes(d.status), `${d.id} is already ${d.status} and should not be pending`);
  }
});

test("Executive Home renders an Attention Required entry for every non-empty bucket", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/home");
  const html = sandbox.__appEl.innerHTML;
  const a = sandbox.computeAttention();
  if (a.unclassified.length) assert.match(html, /Unclassified — sitting in Inbox/);
  if (a.duplicates.length) assert.match(html, /Potential duplicate documents/);
  if (a.awaitingReview.length) assert.match(html, /Awaiting review/);
});
