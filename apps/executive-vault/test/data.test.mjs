import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./loadApp.mjs";

// data.js exposes exactly one global (window.VAULT_DATA) by design — see
// data.js's own top comment — so every field is reached through it, never
// as a bare sandbox.<NAME> property.

test("every document's clientId either is null or refers to a real client", () => {
  const { CLIENTS, DOCUMENTS } = loadApp().VAULT_DATA;
  const ids = new Set(CLIENTS.map((c) => c.id));
  for (const d of DOCUMENTS) {
    assert.ok(d.clientId === null || ids.has(d.clientId), `${d.id} has an unknown clientId "${d.clientId}"`);
  }
});

test("every document's matterId either is null or refers to a real matter", () => {
  const { MATTERS, DOCUMENTS } = loadApp().VAULT_DATA;
  const ids = new Set(MATTERS.map((m) => m.id));
  for (const d of DOCUMENTS) {
    assert.ok(d.matterId === null || ids.has(d.matterId), `${d.id} has an unknown matterId "${d.matterId}"`);
  }
});

test("every matter's document actually shares that matter's client (via its engagement)", () => {
  const { CLIENTS, ENGAGEMENTS, MATTERS, DOCUMENTS } = loadApp().VAULT_DATA;
  const clientOfMatter = (matterId) => {
    const m = MATTERS.find((x) => x.id === matterId);
    if (!m) return null;
    const e = ENGAGEMENTS.find((x) => x.id === m.engagementId);
    return e ? e.clientId : null;
  };
  for (const d of DOCUMENTS) {
    if (!d.matterId) continue;
    assert.equal(d.clientId, clientOfMatter(d.matterId), `${d.id}'s clientId doesn't match its matter's own client chain`);
  }
});

test("every engagement's clientId refers to a real client, and every matter's engagementId refers to a real engagement", () => {
  const { CLIENTS, ENGAGEMENTS, MATTERS } = loadApp().VAULT_DATA;
  const clientIds = new Set(CLIENTS.map((c) => c.id));
  const engIds = new Set(ENGAGEMENTS.map((e) => e.id));
  for (const e of ENGAGEMENTS) assert.ok(clientIds.has(e.clientId), `engagement ${e.id} has an unknown clientId`);
  for (const m of MATTERS) assert.ok(engIds.has(m.engagementId), `matter ${m.id} has an unknown engagementId`);
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

test("every document's function is null or one of the approved 8 Functions", () => {
  const { FUNCTIONS, DOCUMENTS } = loadApp().VAULT_DATA;
  assert.equal(FUNCTIONS.length, 8);
  const fnSet = new Set(FUNCTIONS);
  for (const d of DOCUMENTS) {
    assert.ok(d.function === null || fnSet.has(d.function), `${d.id} has an unknown function "${d.function}"`);
  }
});

test("every document's docType is null or one of the approved Document Types", () => {
  const { DOCUMENT_TYPES, DOCUMENTS } = loadApp().VAULT_DATA;
  assert.ok(DOCUMENT_TYPES.includes("Other"), "Other must remain the escape hatch");
  const typeSet = new Set(DOCUMENT_TYPES);
  for (const d of DOCUMENTS) {
    assert.ok(d.docType === null || typeSet.has(d.docType), `${d.id} has an unknown docType "${d.docType}"`);
  }
});

test("every possibleDuplicateOf reference points at a real document", () => {
  const { DOCUMENTS } = loadApp().VAULT_DATA;
  const ids = new Set(DOCUMENTS.map((d) => d.id));
  for (const d of DOCUMENTS) {
    if (d.possibleDuplicateOf) assert.ok(ids.has(d.possibleDuplicateOf), `${d.id} points at unknown document "${d.possibleDuplicateOf}"`);
  }
});

test("every task and meeting's clientId refers to a real client", () => {
  const { CLIENTS, TASKS, MEETINGS } = loadApp().VAULT_DATA;
  const ids = new Set(CLIENTS.map((c) => c.id));
  for (const t of TASKS) assert.ok(ids.has(t.clientId), `task ${t.id} has an unknown clientId`);
  for (const m of MEETINGS) assert.ok(ids.has(m.clientId), `meeting ${m.id} has an unknown clientId`);
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

test("client, engagement and matter IDs are each unique", () => {
  const { CLIENTS, ENGAGEMENTS, MATTERS } = loadApp().VAULT_DATA;
  assert.equal(new Set(CLIENTS.map((c) => c.id)).size, CLIENTS.length);
  assert.equal(new Set(ENGAGEMENTS.map((e) => e.id)).size, ENGAGEMENTS.length);
  assert.equal(new Set(MATTERS.map((m) => m.id)).size, MATTERS.length);
});

test("the legacy client is flagged legacy:true and is the only legacy client", () => {
  const { CLIENTS } = loadApp().VAULT_DATA;
  const legacyClients = CLIENTS.filter((c) => c.legacy);
  assert.equal(legacyClients.length, 1);
  assert.equal(legacyClients[0].id, "legacy-sabah-resort");
});

test("every non-legacy client has at least one Engagement", () => {
  const { CLIENTS, ENGAGEMENTS } = loadApp().VAULT_DATA;
  for (const c of CLIENTS) {
    const hasEngagement = ENGAGEMENTS.some((e) => e.clientId === c.id);
    assert.ok(hasEngagement, `client ${c.id} has no Engagement record`);
  }
});
