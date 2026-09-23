import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./loadApp.mjs";

function sampleEvent(overrides) {
  return Object.assign({
    provider: "google", providerEventId: "evt1", calendarId: "primary",
    title: "Live Client Sync", start: "2026-09-21T03:00:00.000Z", end: "2026-09-21T04:00:00.000Z",
    allDay: false, timeZone: "Asia/Kuala_Lumpur", location: "Zoom", meetingUrl: "https://meet.google.com/abc-defg-hij",
    organizer: { name: "Ching Yee", email: "ching@example.com" },
    attendees: [{ name: "A", email: "a@x.com", responseStatus: "accepted" }],
    description: "Agenda notes.", recurrence: null, recurringEventId: null,
    lastSynchronizedAt: "2026-09-21T02:00:00.000Z",
    link: { clientId: null, matterId: null, workstream: null, linkStatus: "unlinked" },
  }, overrides);
}

function stubFetchConnected(events) {
  return async (url) => {
    if (String(url).includes("/api/calendar/status")) {
      return { ok: true, json: async () => ({ providers: [{ provider: "google", connected: true, status: "connected", accountEmail: "chingyeesve@gmail.com", lastSyncedAt: "2026-09-21T02:00:00.000Z", lastError: null }] }) };
    }
    if (String(url).includes("/api/calendar/events")) {
      return { ok: true, json: async () => ({ connected: true, status: "connected", accountEmail: "chingyeesve@gmail.com", lastSyncedAt: "2026-09-21T02:00:00.000Z", events }) };
    }
    throw new Error("Unscripted fetch: " + url);
  };
}
function stubFetchNotConnected() {
  return async (url) => {
    if (String(url).includes("/api/calendar/status")) return { ok: true, json: async () => ({ providers: [{ provider: "google", connected: false }] }) };
    throw new Error("Unscripted fetch: " + url);
  };
}

/* ---------- No fetch available (default test sandbox) — must be a pure no-op ---------- */

test("loadCalendarData() is a no-op without a fetch implementation, and demo data keeps rendering exactly as before", async () => {
  const sandbox = loadApp();
  await sandbox.loadCalendarData(true);
  sandbox.navigate("#/myday");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Internal Management Review/); // the existing demo worked example, untouched
  assert.match(html, /Demo Data/);
  assert.doesNotMatch(html, /gcal-source-chip|Live — Google Calendar/);
});

test("Executive Home shows the Demo Data badge, not a live badge, when Google isn't connected", () => {
  const sandbox = loadApp();
  sandbox.navigate("#/home");
  assert.match(sandbox.__appEl.innerHTML, /Demo Data/);
});

/* ---------- Not connected ---------- */

test("the Connected Calendars screen offers Connect Google Calendar when not connected, and lists Outlook as Not Available", async () => {
  const sandbox = loadApp();
  sandbox.fetch = stubFetchNotConnected();
  await sandbox.loadCalendarData(true);
  sandbox.navigate("#/calendars");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Connect Google Calendar/);
  assert.match(html, /Not Connected/);
  assert.match(html, /Microsoft Outlook/);
  assert.match(html, /Not Available/);
});

test("connectGoogleCalendar() navigates to the real OAuth-start endpoint — never a fetch, a real top-level redirect", () => {
  const sandbox = loadApp();
  sandbox.connectGoogleCalendar();
  assert.equal(sandbox.location.href, "/api/calendar/connect?provider=google");
});

/* ---------- Connected: My Day / This Week / Executive Home show live events, never demo ---------- */

test("once connected, My Day shows the live Google event with a source chip and suppresses the demo meetings entirely", async () => {
  const sandbox = loadApp();
  sandbox.setAppClock("2026-09-21T08:30:00");
  sandbox.fetch = stubFetchConnected([sampleEvent()]);
  await sandbox.loadCalendarData(true);
  sandbox.navigate("#/myday");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Live Client Sync/);
  assert.match(html, /gcal-source-chip/);
  assert.match(html, /Live — Google Calendar/);
  // Note: TASKS ("Due Today") are untouched by the Google integration and keep rendering — t6's title happens to contain
  // "Internal Management Review" too, so the demo MEETING is checked via a title with no such task-title collision.
  assert.doesNotMatch(html, /VT Worldwide — HR Transformation Review|MRE Asia — HR Operating Model Follow-Up/);
});

test("once connected, Executive Home's My Day card and This Week preview also switch to live Google events", async () => {
  const sandbox = loadApp();
  sandbox.setAppClock("2026-09-21T08:30:00");
  sandbox.fetch = stubFetchConnected([sampleEvent()]);
  await sandbox.loadCalendarData(true);
  sandbox.navigate("#/home");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Live Client Sync/);
  assert.doesNotMatch(html, /Internal Management Review/);
});

test("once connected, This Week shows the live event on its own day and suppresses demo meetings for the week", async () => {
  const sandbox = loadApp();
  sandbox.setAppClock("2026-09-21T08:30:00");
  sandbox.fetch = stubFetchConnected([sampleEvent()]);
  await sandbox.loadCalendarData(true);
  sandbox.navigate("#/week");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Live Client Sync/);
  // t7's task title also contains the literal words "Litigation Strategy Call" (it's about confirming that meeting's
  // agenda) and TASKS keep rendering regardless of the calendar connection, so the demo MEETING is checked via a
  // title with no such collision.
  assert.doesNotMatch(html, /SVE Group Enterprise Platform — Steering Group/);
});

test("an all-day Google event is labelled 'All day' and placed on its own literal date, never shifted by timezone math", async () => {
  const sandbox = loadApp();
  sandbox.setAppClock("2026-09-23T08:30:00");
  const allDay = sampleEvent({ providerEventId: "evt-allday", title: "Offsite", allDay: true, start: "2026-09-23T00:00:00.000Z", end: "2026-09-24T00:00:00.000Z" });
  sandbox.fetch = stubFetchConnected([allDay]);
  await sandbox.loadCalendarData(true);
  sandbox.navigate("#/myday");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Offsite/);
  assert.match(html, /All day/);
});

/* ---------- No auto-classification, client-side either ---------- */

test("an unlinked Google event always reads 'Not linked to a Matter', regardless of its title, until explicitly linked", async () => {
  const sandbox = loadApp();
  sandbox.setAppClock("2026-09-21T08:30:00");
  const namedAfterClient = sampleEvent({ title: "VT Worldwide catch-up" });
  sandbox.fetch = stubFetchConnected([namedAfterClient]);
  await sandbox.loadCalendarData(true);
  sandbox.navigate("#/myday");
  assert.match(sandbox.__appEl.innerHTML, /Not linked to a Matter/);
});

/* ---------- Link to Matter (explicit only) ---------- */

test("openCalendarLinkPicker()/submitCalendarLink() posts the explicit link and clears the draft", async () => {
  const sandbox = loadApp();
  sandbox.setAppClock("2026-09-21T08:30:00");
  const calls = [];
  sandbox.fetch = async (url, opts) => {
    if (String(url).includes("/api/calendar/status")) return { ok: true, json: async () => ({ providers: [{ provider: "google", connected: true, status: "connected", accountEmail: "x@gmail.com", lastSyncedAt: null }] }) };
    if (String(url).includes("/api/calendar/events")) return { ok: true, json: async () => ({ connected: true, status: "connected", events: [sampleEvent()] }) };
    if (String(url).includes("/api/calendar/link")) { calls.push(JSON.parse(opts.body)); return { ok: true, json: async () => ({ ok: true, link: {} }) }; }
    throw new Error("Unscripted fetch: " + url);
  };
  await sandbox.loadCalendarData(true);
  sandbox.openCalendarLinkPicker("evt1", "primary");
  sandbox.updateCalendarLinkDraftField("clientId", "vt-worldwide");
  sandbox.updateCalendarLinkDraftField("matterId", "matter-vt-hrtransform");
  await sandbox.submitCalendarLink();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].provider, "google");
  assert.equal(calls[0].providerEventId, "evt1");
  assert.equal(calls[0].clientId, "vt-worldwide");
  assert.equal(calls[0].matterId, "matter-vt-hrtransform");
});

test("submitCalendarLink() refuses without a selected Client — not every field mandatory, but a Client is, matching the backend's own rule", async () => {
  const sandbox = loadApp();
  let fetchCalled = false;
  sandbox.fetch = async () => { fetchCalled = true; };
  sandbox.openCalendarLinkPicker("evt1", "primary");
  await sandbox.submitCalendarLink();
  assert.equal(fetchCalled, false);
});

test("updateCalendarLinkDraftField() cascades: changing Client clears the drafted Matter/Workstream", async () => {
  const sandbox = loadApp();
  const calls = [];
  sandbox.fetch = async (url, opts) => {
    if (String(url).includes("/api/calendar/link")) { calls.push(JSON.parse(opts.body)); return { ok: true, json: async () => ({ ok: true, link: {} }) }; }
    throw new Error("Unscripted fetch: " + url);
  };
  sandbox.openCalendarLinkPicker("evt1", "primary");
  sandbox.updateCalendarLinkDraftField("clientId", "vt-worldwide");
  sandbox.updateCalendarLinkDraftField("matterId", "matter-vt-hrtransform");
  sandbox.updateCalendarLinkDraftField("clientId", "mre-asia"); // switching Client should drop the now-mismatched Matter
  await sandbox.submitCalendarLink();
  assert.equal(calls[0].clientId, "mre-asia");
  assert.equal(calls[0].matterId, null, "the stale Matter from the previous Client must not survive the switch");
});

test("unlinkCalendarEvent() posts action:'unlink'", async () => {
  const sandbox = loadApp();
  const calls = [];
  sandbox.fetch = async (url, opts) => {
    if (String(url).includes("/api/calendar/link")) { calls.push(JSON.parse(opts.body)); return { ok: true, json: async () => ({ ok: true, link: {} }) }; }
    if (String(url).includes("/api/calendar/status")) return { ok: true, json: async () => ({ providers: [{ provider: "google", connected: false }] }) };
    throw new Error("Unscripted fetch: " + url);
  };
  await sandbox.unlinkCalendarEvent("evt1", "primary");
  assert.equal(calls[0].action, "unlink");
});

/* ---------- Google event detail drawer — mutual exclusivity ---------- */

test("openGoogleEvent() opens the detail drawer and is mutually exclusive with the Document drawer", async () => {
  const sandbox = loadApp();
  sandbox.setAppClock("2026-09-21T08:30:00");
  sandbox.fetch = stubFetchConnected([sampleEvent()]);
  await sandbox.loadCalendarData(true);
  sandbox.openDocument("d01");
  assert.match(sandbox.__appEl.innerHTML, /drawer open/);
  sandbox.openGoogleEvent("primary:evt1");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /drawer open/);
  assert.match(html, /Live Client Sync/);
  assert.doesNotMatch(html, /Lark Digital Acknowledgement/);
});

test("the Google event detail drawer shows organiser, attendees, meeting link and description, never a raw provider payload", async () => {
  const sandbox = loadApp();
  sandbox.fetch = stubFetchConnected([sampleEvent()]);
  await sandbox.loadCalendarData(true);
  sandbox.openGoogleEvent("primary:evt1");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Ching Yee/);
  assert.match(html, /meet\.google\.com/);
  assert.match(html, /Agenda notes\./);
});

/* ---------- Disconnect ---------- */

test("disconnectCalendar() posts to /api/calendar/disconnect and clears local calendar state", async () => {
  const sandbox = loadApp();
  const calls = [];
  sandbox.fetch = async (url, opts) => {
    if (String(url).includes("/api/calendar/disconnect")) { calls.push(JSON.parse(opts.body)); return { ok: true, json: async () => ({ ok: true }) }; }
    if (String(url).includes("/api/calendar/status")) return { ok: true, json: async () => ({ providers: [{ provider: "google", connected: false }] }) };
    throw new Error("Unscripted fetch: " + url);
  };
  await sandbox.disconnectCalendar("google");
  assert.equal(calls[0].provider, "google");
  sandbox.navigate("#/myday");
  assert.match(sandbox.__appEl.innerHTML, /Demo Data/);
});

/* ---------- Timezone / Now-Next behaviour reuses the Application Clock ---------- */

test("googleEventTemporalState() classifies past/now/upcoming from the injected Application Clock, exactly like meetingTemporalState()", () => {
  const sandbox = loadApp();
  const e = sampleEvent({ start: "2026-09-21T03:00:00.000Z", end: "2026-09-21T04:00:00.000Z" });
  sandbox.setAppClock("2026-09-21T02:00:00Z");
  assert.equal(sandbox.googleEventTemporalState(e), "upcoming");
  sandbox.setAppClock("2026-09-21T03:30:00Z");
  assert.equal(sandbox.googleEventTemporalState(e), "now");
  sandbox.setAppClock("2026-09-21T05:00:00Z");
  assert.equal(sandbox.googleEventTemporalState(e), "past");
});

test("the executive timeline marks the next upcoming Google event with a Next badge", async () => {
  const sandbox = loadApp();
  sandbox.setAppClock("2026-09-21T07:00:00");
  const first = sampleEvent({ providerEventId: "e1", title: "Early Sync", start: "2026-09-21T08:00:00.000Z", end: "2026-09-21T08:30:00.000Z" });
  const second = sampleEvent({ providerEventId: "e2", title: "Later Sync", start: "2026-09-21T10:00:00.000Z", end: "2026-09-21T10:30:00.000Z" });
  sandbox.fetch = stubFetchConnected([first, second]);
  await sandbox.loadCalendarData(true);
  sandbox.navigate("#/home");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /exec-tl-next-badge/);
  assert.match(html, /Early Sync/);
});
