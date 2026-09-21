import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./loadApp.mjs";

test("computeAttention()'s unclassified list matches exactly the documents with classified:false", () => {
  const sandbox = loadApp();
  const { DOCUMENTS } = sandbox.VAULT_DATA;
  const expected = DOCUMENTS.filter((d) => !d.classified).map((d) => d.id).sort();
  const actual = sandbox.computeAttention().unclassified.map((d) => d.id).sort();
  assert.deepEqual(actual, expected);
});

test("computeAttention()'s duplicates list matches exactly the documents flagged possibleDuplicateOf", () => {
  const sandbox = loadApp();
  const { DOCUMENTS } = sandbox.VAULT_DATA;
  const expected = DOCUMENTS.filter((d) => d.classified && d.possibleDuplicateOf).map((d) => d.id).sort();
  const actual = sandbox.computeAttention().duplicates.map((d) => d.id).sort();
  assert.deepEqual(actual, expected);
});

test("computeAttention()'s confidentialFlagged list is exactly the Highly Confidential classified documents", () => {
  const sandbox = loadApp();
  const { DOCUMENTS } = sandbox.VAULT_DATA;
  const expected = DOCUMENTS.filter((d) => d.classified && d.confidentiality === "highly-confidential").map((d) => d.id).sort();
  const actual = sandbox.computeAttention().confidentialFlagged.map((d) => d.id).sort();
  assert.deepEqual(actual, expected);
});

test("computeAttention()'s followUps list is exactly the not-done tasks", () => {
  const sandbox = loadApp();
  const { TASKS } = sandbox.VAULT_DATA;
  const expected = TASKS.filter((t) => !t.done).map((t) => t.id).sort();
  const actual = sandbox.computeAttention().followUps.map((t) => t.id).sort();
  assert.deepEqual(actual, expected);
});

test("marking every task done empties followUps", () => {
  const sandbox = loadApp();
  sandbox.VAULT_DATA.TASKS.forEach((t) => { if (!t.done) sandbox.toggleTask(t.id); });
  assert.equal(sandbox.computeAttention().followUps.length, 0);
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
