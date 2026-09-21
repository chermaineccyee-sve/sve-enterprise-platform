import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./loadApp.mjs";

// data.js exposes exactly one global (window.VAULT_DATA) by design — see
// data.js's own top comment — so every field is reached through it, never
// as a bare sandbox.<NAME> property.

test("every document's engagementId either is null or refers to a real engagement", () => {
  const { ENGAGEMENTS, DOCUMENTS } = loadApp().VAULT_DATA;
  const engIds = new Set(ENGAGEMENTS.map((e) => e.id));
  for (const d of DOCUMENTS) {
    assert.ok(d.engagementId === null || engIds.has(d.engagementId), `${d.id} has an unknown engagementId "${d.engagementId}"`);
  }
});

test("every document's confidentiality is a defined classification tier", () => {
  const { CLASSIFICATIONS, DOCUMENTS } = loadApp().VAULT_DATA;
  const tierIds = new Set(CLASSIFICATIONS.map((c) => c.id));
  for (const d of DOCUMENTS) {
    assert.ok(tierIds.has(d.confidentiality), `${d.id} has an unknown confidentiality "${d.confidentiality}"`);
  }
});

test("every document's status is a defined lifecycle status", () => {
  const { STATUSES, DOCUMENTS } = loadApp().VAULT_DATA;
  const statusSet = new Set(STATUSES);
  for (const d of DOCUMENTS) {
    assert.ok(statusSet.has(d.status), `${d.id} has an unknown status "${d.status}"`);
  }
});

test("every document's function is null or a defined function", () => {
  const { FUNCTIONS, DOCUMENTS } = loadApp().VAULT_DATA;
  const fnSet = new Set(FUNCTIONS);
  for (const d of DOCUMENTS) {
    assert.ok(d.function === null || fnSet.has(d.function), `${d.id} has an unknown function "${d.function}"`);
  }
});

test("every possibleDuplicateOf reference points at a real document", () => {
  const { DOCUMENTS } = loadApp().VAULT_DATA;
  const ids = new Set(DOCUMENTS.map((d) => d.id));
  for (const d of DOCUMENTS) {
    if (d.possibleDuplicateOf) assert.ok(ids.has(d.possibleDuplicateOf), `${d.id} points at unknown document "${d.possibleDuplicateOf}"`);
  }
});

test("every task and meeting's engagementId refers to a real engagement", () => {
  const { ENGAGEMENTS, TASKS, MEETINGS } = loadApp().VAULT_DATA;
  const engIds = new Set(ENGAGEMENTS.map((e) => e.id));
  for (const t of TASKS) assert.ok(engIds.has(t.engagementId), `task ${t.id} has an unknown engagementId`);
  for (const m of MEETINGS) assert.ok(engIds.has(m.engagementId), `meeting ${m.id} has an unknown engagementId`);
});

test("classified documents always carry a Drive path and URL (never an orphaned record)", () => {
  const { DOCUMENTS } = loadApp().VAULT_DATA;
  for (const d of DOCUMENTS.filter((x) => x.classified)) {
    assert.ok(d.drivePath && d.drivePath.length, `${d.id} is classified but has no drivePath`);
    assert.ok(d.driveUrl && d.driveUrl.length, `${d.id} is classified but has no driveUrl`);
  }
});

test("document IDs are unique", () => {
  const { DOCUMENTS } = loadApp().VAULT_DATA;
  const ids = DOCUMENTS.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("engagement IDs are unique", () => {
  const { ENGAGEMENTS } = loadApp().VAULT_DATA;
  const ids = ENGAGEMENTS.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});
