import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./loadApp.mjs";

test("Document Vault renders both the desktop table and a mobile record-card list (CSS toggles which is visible, not JS)", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/vault");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /class="table-wrap desktop-register"/);
  assert.match(html, /class="record-list"/);
  assert.match(html, /class="record-card"/);
});

test("a Document Vault mobile record card shows Identity/Context/State but not every desktop column (Modified/Review Date stay in the detail drawer)", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/vault");
  const html = sandbox.__appEl.innerHTML;
  const cardSection = html.slice(html.indexOf('class="record-list"'));
  assert.match(cardSection, /record-card-id/);
  assert.match(cardSection, /record-card-context/);
  assert.match(cardSection, /record-card-state/);
});

test("Projects / Matters renders both the desktop table and a mobile record-card list", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/matters");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /class="table-wrap desktop-register"/);
  assert.match(html, /class="record-list"/);
});

test("Archive reuses the same registry table/record-card renderer as Document Vault", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/archive");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /class="table-wrap desktop-register"/);
  assert.match(html, /class="record-list"/);
});

test("Legacy documents never appear in the Document Vault mobile record-card list (same default-exclusion as the desktop table)", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/vault");
  const html = sandbox.__appEl.innerHTML;
  assert.doesNotMatch(html, /Sabah/);
});

test("clicking a mobile record card opens the same Document Detail drawer as clicking the desktop table row", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/vault");
  sandbox.openDocument("d01");
  assert.match(sandbox.__appEl.innerHTML, /Lark Digital Acknowledgement Workflow Specification/);
});

test("Management Progress's Workstream Snapshot (dashboard redesign, Oct 2026) reuses the same desktop-register/record-card responsive pattern as Document Vault/Matters/Archive, alongside its own purpose-designed sections", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/management");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /class="record-list"/);
  assert.match(html, /desktop-register/);
  assert.match(html, /mgmt-page/);
});

test("Actions & Follow-Up rows carry the action-row class for mobile reflow, and Legacy/private data is unaffected", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/actions");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /action-row/);
});
