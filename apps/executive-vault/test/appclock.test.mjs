import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./loadApp.mjs";

/* ---------- The Application Clock itself ---------- */

test("TODAY/NOW derive from the test suite's fixed clock (loadApp.mjs's __FIXED_CLOCK__), not a data.js constant", () => {
  const sandbox = loadApp();
  assert.equal(sandbox.TODAY, "2026-09-21");
  assert.equal(sandbox.NOW, "08:30");
  assert.equal(sandbox.VAULT_DATA.TODAY, undefined, "data.js must no longer export a fixture TODAY/NOW — today is live application state, not mock data");
  assert.equal(sandbox.VAULT_DATA.NOW, undefined);
});

test("setAppClock() moves TODAY/NOW to an arbitrary injected instant — the same mechanism a test uses to avoid depending on the real calendar", () => {
  const sandbox = loadApp();
  sandbox.setAppClock("2027-03-15T14:05:00");
  assert.equal(sandbox.TODAY, "2027-03-15");
  assert.equal(sandbox.NOW, "14:05");
});

test("setAppClock(null) releases the override back to the real system clock", () => {
  const sandbox = loadApp();
  sandbox.setAppClock("2027-03-15T14:05:00");
  assert.equal(sandbox.TODAY, "2027-03-15");
  sandbox.setAppClock(null);
  assert.match(sandbox.TODAY, /^\d{4}-\d{2}-\d{2}$/);
  assert.notEqual(sandbox.TODAY, "2027-03-15");
});

test("appTimeZone() resolves the real environment's IANA zone via Intl — never a hard-coded Malaysia/Singapore offset", () => {
  const sandbox = loadApp();
  const expected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  assert.equal(sandbox.appTimeZone(), expected);
});

test("render() refreshes TODAY/NOW from the clock on every call, so a mid-session clock change takes effect on the next interaction", () => {
  const sandbox = loadApp();
  sandbox.setAppClock("2026-11-02T10:00:00");
  sandbox.navigate("#/home");
  assert.equal(sandbox.TODAY, "2026-11-02");
  assert.match(sandbox.__appEl.innerHTML, /2 November 2026/);
});

/* ---------- My Day / Executive Home must reflect the REAL current day ---------- */

test("on a date the fixture has no meetings for, My Day shows an honest empty state — no demo meeting is shifted onto today", () => {
  const sandbox = loadApp();
  sandbox.setAppClock("2026-10-05T09:00:00"); // a Monday with zero MEETINGS/TASKS fixture entries
  sandbox.navigate("#/myday");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Nothing on the calendar today/);
  for (const title of ["Internal Management Review", "VT Worldwide — HR Transformation Review", "MRE Asia — HR Operating Model Follow-Up", "Nusantara — Documentation Review"]) {
    assert.doesNotMatch(html, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `"${title}" is a 2026-09-21 fixture meeting and must not appear as today's meeting on 2026-10-05`);
  }
});

test("Executive Home's My Day card also shows the honest empty state on a day with no fixture meetings", () => {
  const sandbox = loadApp();
  sandbox.setAppClock("2026-10-05T09:00:00");
  sandbox.navigate("#/home");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Nothing on the calendar today/);
  assert.doesNotMatch(html, /VT Worldwide — HR Transformation Review/);
});

test("on the fixture's own 2026-09-21, My Day still shows its worked-example meetings — historical/demo dates remain valid on their own actual day", () => {
  const sandbox = loadApp();
  sandbox.setAppClock("2026-09-21T09:00:00");
  sandbox.navigate("#/myday");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Internal Management Review/);
  assert.match(html, /VT Worldwide — HR Transformation Review/);
});

/* ---------- NOW/NEXT meeting indicators track the injected clock ---------- */

test("meetingTemporalState() classifies past/now/upcoming from the live clock, not a fixed NOW", () => {
  const sandbox = loadApp();
  const m4 = sandbox.getMeeting("m4"); // 2026-09-21, 11:00–13:00
  sandbox.setAppClock("2026-09-21T07:00:00");
  assert.equal(sandbox.meetingTemporalState(m4), "upcoming");
  sandbox.setAppClock("2026-09-21T12:00:00");
  assert.equal(sandbox.meetingTemporalState(m4), "now");
  sandbox.setAppClock("2026-09-21T18:00:00");
  assert.equal(sandbox.meetingTemporalState(m4), "past");
});

test("Executive Home's live 'now' indicator (the Now marker / live-dot) reflects the injected clock", () => {
  const sandbox = loadApp();
  sandbox.setAppClock("2026-09-21T12:00:00"); // inside m4's 11:00–13:00 window
  sandbox.navigate("#/home");
  assert.match(sandbox.__appEl.innerHTML, /live-dot/);
});

/* ---------- Weekly/Monthly Review + relative-date defaults follow the clock ---------- */

test("Monthly Review's default month follows the injected clock, not a fixed month", () => {
  const sandbox = loadApp();
  sandbox.setAppClock("2027-01-10T09:00:00");
  sandbox.navigate("#/management");
  sandbox.setMgmtView("monthly");
  assert.match(sandbox.__appEl.innerHTML, /January 2027/);
});

test("Weekly Review's default week follows the injected clock", () => {
  const sandbox = loadApp();
  sandbox.setAppClock("2027-01-13T09:00:00"); // a Wednesday
  sandbox.navigate("#/management");
  sandbox.setMgmtView("weekly");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /11 Jan 2027/); // that week's Monday
  assert.match(html, /17 Jan 2027/); // that week's Sunday
});

test("This Week's date range is computed from the injected clock", () => {
  const sandbox = loadApp();
  sandbox.setAppClock("2027-06-16T09:00:00"); // a Wednesday
  sandbox.navigate("#/week");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /14 Jun 2027/); // week start (Monday)
  assert.match(html, /20 Jun 2027/); // week end (Sunday)
});

/* ---------- Progress Update timestamps use the same clock (no parallel Date.now() source) ---------- */

test("submitProgressUpdate() stamps createdAt/updatedAt from the same injected clock, not an independent Date.now()", () => {
  const sandbox = loadApp();
  sandbox.setAppClock("2027-02-01T10:15:00");
  sandbox.openProgressUpdateForm("matter-mre-opmodel");
  sandbox.updateProgressDraftField("text", "Clock-consistency check.");
  sandbox.submitProgressUpdate();
  const created = sandbox.VAULT_DATA.PROGRESS_UPDATES.find((p) => p.text === "Clock-consistency check.");
  assert.ok(created);
  assert.equal(created.createdAt, new Date("2027-02-01T10:15:00").toISOString());
  assert.equal(created.updatedAt, created.createdAt);
});
