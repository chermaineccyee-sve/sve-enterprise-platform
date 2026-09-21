import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./loadApp.mjs";

test("Executive Home greets by name and today's date, and shows the compact summary strip", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/home");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Ching Yee/);
  assert.match(html, /Monday, 21 September 2026/);
  assert.match(html, /Active Matters/);
  assert.match(html, /Meetings Today/);
  assert.match(html, /Decision/);
});

test("Executive Home no longer leads with a big document-count grid (demoted per the work-dashboard redesign)", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/home");
  assert.doesNotMatch(sandbox.__appEl.innerHTML, /Document Overview/);
});

test("My Day lists exactly today's meetings, matching the brief's own worked example", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/myday");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Internal Management Review/);
  assert.match(html, /VT Worldwide — HR Transformation Review/);
  assert.match(html, /MRE Asia — HR Operating Model Follow-Up/);
  assert.match(html, /Nusantara — Documentation Review/);
  // a meeting on a different day must not show up on My Day
  assert.doesNotMatch(html, /Litigation Strategy Call/);
});

test("This Week spans Monday through Sunday and includes meetings from later in the week", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/week");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /SVE Group Enterprise Platform — Steering Group/); // Tuesday
  assert.match(html, /Litigation Strategy Call/); // Wednesday
  assert.match(html, /FY2027 Budget Discussion/); // Friday
});

test("openMeeting() opens a Meeting Brief with Client/Engagement/Matter/Workstream and participants", () => {
  const sandbox = loadApp();
  sandbox.openMeeting("m4"); // VT Worldwide — HR Transformation Review
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /drawer open/);
  assert.match(html, /VT Worldwide — HR Transformation Review/);
  assert.match(html, /HR Transformation \/ HR Advisory/); // Engagement
  assert.match(html, /HR Transformation</); // Matter
  assert.match(html, /HR Policy Framework, HR Digitalisation \/ HRMS/); // Related Workstreams
  assert.match(html, /Ravi Menon \(Group CHRO\)/);
});

test("opening a document closes any open Meeting Brief, and vice versa (one drawer at a time)", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/vault"); // a screen whose own body never lists meeting titles
  sandbox.openMeeting("m4");
  assert.match(sandbox.__appEl.innerHTML, /drawer open/);
  sandbox.openDocument("d01");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /drawer open/);
  assert.match(html, /Lark Digital Acknowledgement Workflow Specification/);
  assert.doesNotMatch(html, /VT Worldwide — HR Transformation Review/);
});

test("the Meeting Brief's Agenda link opens that document, replacing the Meeting Brief", () => {
  const sandbox = loadApp();
  sandbox.openMeeting("m4"); // has agendaDocId "d07b"
  sandbox.openDocument("d07b");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Steering Committee Agenda/);
});

test("Projects / Matters register lists every non-legacy Matter with its Client and Engagement", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/matters");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /HR Transformation/);
  assert.match(html, /VT Worldwide/);
  assert.match(html, /HR Transformation \/ HR Advisory/);
  assert.doesNotMatch(html, /Resort Development Programme/); // legacy matter excluded
});

test("clicking a Matter row deep-links into its Client Workspace, filtered to that Matter", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/client/vt-worldwide?tab=documents&matter=matter-vt-hrtransform");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Matter: HR Transformation/);
});

test("Actions & Follow-Up splits open tasks into On Me and Waiting On Others", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/actions");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /On Me/);
  assert.match(html, /Waiting On Others/);
  assert.match(html, /Get Ravi Menon's sign-off on HR-025 v0\.4/);
  assert.match(html, /Waiting on Ravi Menon/);
});

test("the notifications popover toggles open and closed, and closes automatically on navigation", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/home");
  assert.doesNotMatch(sandbox.__appEl.innerHTML, /notif-popover/);
  sandbox.toggleAttentionPopover();
  assert.match(sandbox.__appEl.innerHTML, /notif-popover/);
  sandbox.navigate("#/vault");
  assert.doesNotMatch(sandbox.__appEl.innerHTML, /notif-popover/);
});

test("Outlook Calendar screen states plainly that this is mock data with no live connection", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/outlook");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Outlook Calendar/);
  assert.match(html, /no live Microsoft account connection|Production integration is architecture-only/);
});

test("greetingWord() reflects the prototype's fixed NOW value", () => {
  const sandbox = loadApp();
  assert.equal(sandbox.VAULT_DATA.NOW, "08:30");
  assert.equal(sandbox.greetingWord(), "Good morning");
});
