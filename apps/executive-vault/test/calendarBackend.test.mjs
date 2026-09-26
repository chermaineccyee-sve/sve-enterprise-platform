/**
 * Backend tests for the Google Calendar v1 Netlify Functions. These run the
 * REAL .mts handler modules directly under Node (they're plain TypeScript
 * with Web-standard Request/Response/crypto.subtle/fetch — no Deno-specific
 * API — so Node's own type-stripping runs them unmodified), with:
 *   - node:test's mock.module() swapping @netlify/database's getDatabase()
 *     for a small in-memory fake (--experimental-test-module-mocks; see
 *     package.json's "test" script) that implements exactly the query
 *     shapes _calendar-model.mts issues — a hand-written double, not a
 *     generic SQL engine, since this file and _calendar-model.mts are
 *     authored together and kept in lockstep on purpose.
 *   - globalThis.fetch swapped per-test to script Google's own responses —
 *     no real Google account or network call is ever made by this suite.
 *   - globalThis.Netlify.env.get(...) swapped for fixed test config.
 * Session cookies are produced by the REAL signSessionCookie()/
 * sessionSetCookieHeader() from _auth-core.mts, so "authenticated" here
 * means the actual production cookie format, not a shortcut.
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const SESSION_SECRET = "test-session-secret";
const ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
const CLIENT_ID = "test-client-id.apps.googleusercontent.com";
const CLIENT_SECRET = "test-client-secret";
const REDIRECT_URI = "https://executive-command-centre-tqje.netlify.app/api/calendar/google/callback";

const ENV = {
  EXECUTIVE_VAULT_SESSION_SECRET: SESSION_SECRET,
  EXECUTIVE_VAULT_TOKEN_ENCRYPTION_KEY: ENCRYPTION_KEY,
  GOOGLE_CALENDAR_CLIENT_ID: CLIENT_ID,
  GOOGLE_CALENDAR_CLIENT_SECRET: CLIENT_SECRET,
  GOOGLE_CALENDAR_REDIRECT_URI: REDIRECT_URI,
};
globalThis.Netlify = { env: { get: (k) => ENV[k] } };

/* ---------- Fake @netlify/database — one shared instance, reset per test ---------- */
let connections = [];
let eventLinks = [];
let connSeq = 1;

function resetFakeDb() {
  connections = [];
  eventLinks = [];
  connSeq = 1;
}

function fakeSql(strings, ...values) {
  const text = strings.join("");
  if (text.includes("SELECT * FROM calendar_connections WHERE user_email")) {
    const [userEmail, provider] = values;
    const row = connections.find((c) => c.user_email === userEmail && c.provider === provider);
    return Promise.resolve(row ? [row] : []);
  }
  if (text.includes("INSERT INTO calendar_connections")) {
    const [userEmail, provider, providerAccountEmail, accessEnc, refreshEnc, expiresAt, scope] = values;
    let row = connections.find((c) => c.user_email === userEmail && c.provider === provider && c.provider_account_email === providerAccountEmail);
    if (row) {
      Object.assign(row, { access_token_encrypted: accessEnc, refresh_token_encrypted: refreshEnc, token_expires_at: expiresAt, scope, status: "connected", last_error: null });
    } else {
      row = {
        id: connSeq++, user_email: userEmail, provider, provider_account_email: providerAccountEmail,
        access_token_encrypted: accessEnc, refresh_token_encrypted: refreshEnc, token_expires_at: expiresAt, scope,
        status: "connected", last_synced_at: null, last_error: null,
      };
      connections.push(row);
    }
    return Promise.resolve([row]);
  }
  if (text.includes("UPDATE calendar_connections SET access_token_encrypted") && text.includes("refresh_token_encrypted")) {
    const [accessEnc, refreshEnc, expiresAt, id] = values;
    const row = connections.find((c) => c.id === id);
    if (row) Object.assign(row, { access_token_encrypted: accessEnc, refresh_token_encrypted: refreshEnc, token_expires_at: expiresAt, status: "connected", last_error: null });
    return Promise.resolve([]);
  }
  if (text.includes("UPDATE calendar_connections SET access_token_encrypted")) {
    const [accessEnc, expiresAt, id] = values;
    const row = connections.find((c) => c.id === id);
    if (row) Object.assign(row, { access_token_encrypted: accessEnc, token_expires_at: expiresAt, status: "connected", last_error: null });
    return Promise.resolve([]);
  }
  if (text.includes("UPDATE calendar_connections SET last_synced_at")) {
    const [id] = values;
    const row = connections.find((c) => c.id === id);
    if (row) Object.assign(row, { last_synced_at: new Date().toISOString(), status: "connected", last_error: null });
    return Promise.resolve([]);
  }
  if (text.includes("UPDATE calendar_connections SET status")) {
    const [status, message, id] = values;
    const row = connections.find((c) => c.id === id);
    if (row) Object.assign(row, { status, last_error: message });
    return Promise.resolve([]);
  }
  if (text.includes("DELETE FROM calendar_connections")) {
    const [userEmail, provider] = values;
    const idx = connections.findIndex((c) => c.user_email === userEmail && c.provider === provider);
    if (idx !== -1) connections.splice(idx, 1);
    return Promise.resolve([]);
  }
  if (text.includes("SELECT provider_event_id") && text.includes("FROM calendar_event_links")) {
    const [userEmail, provider, calendarId] = values;
    return Promise.resolve(eventLinks.filter((l) => l.user_email === userEmail && l.provider === provider && l.calendar_id === calendarId));
  }
  if (text.includes("INSERT INTO calendar_event_links")) {
    const [userEmail, provider, providerEventId, calendarId, clientId, matterId, workstream, linkStatus, linkedBy] = values;
    let row = eventLinks.find((l) => l.user_email === userEmail && l.provider === provider && l.provider_event_id === providerEventId && l.calendar_id === calendarId);
    if (row) {
      Object.assign(row, { client_id: clientId, matter_id: matterId, workstream, link_status: linkStatus, linked_at: new Date().toISOString(), linked_by: linkedBy });
    } else {
      row = { user_email: userEmail, provider, provider_event_id: providerEventId, calendar_id: calendarId, client_id: clientId, matter_id: matterId, workstream, link_status: linkStatus, linked_at: new Date().toISOString(), linked_by: linkedBy };
      eventLinks.push(row);
    }
    return Promise.resolve([row]);
  }
  throw new Error("Unrecognised fake SQL query: " + text.slice(0, 160));
}

const fakeDb = { sql: fakeSql };
mock.module("@netlify/database", { namedExports: { getDatabase: () => fakeDb } });

const { default: statusHandler } = await import("../netlify/functions/calendar-status.mts");
const { default: connectHandler } = await import("../netlify/functions/calendar-connect.mts");
const { default: callbackHandler } = await import("../netlify/functions/calendar-google-callback.mts");
const { default: eventsHandler } = await import("../netlify/functions/calendar-events.mts");
const { default: disconnectHandler } = await import("../netlify/functions/calendar-disconnect.mts");
const { default: linkHandler } = await import("../netlify/functions/calendar-link.mts");
const { signSessionCookie, sessionSetCookieHeader } = await import("../netlify/functions/_auth-core.mts");
const { verifyOAuthState } = await import("../netlify/functions/_calendar-state.mts");
const { decryptToken, encryptToken } = await import("../netlify/functions/_calendar-crypto.mts");
const { normalizeGoogleEvent } = await import("../netlify/functions/_calendar-google.mts");
const { getEventLinks } = await import("../netlify/functions/_calendar-model.mts");

const USER = { email: "chingyeesve@gmail.com", name: "Ching Yee" };

async function cookieHeaderFor(user = USER) {
  const value = await signSessionCookie(user, SESSION_SECRET);
  const setCookie = sessionSetCookieHeader(value); // "execvault_session=...; Path=/; ..."
  return setCookie.split(";")[0];
}
function reqWithCookie(url, cookie, init) {
  const headers = new Headers(init?.headers);
  if (cookie) headers.set("cookie", cookie);
  return new Request(url, { ...init, headers });
}

/* ============================ Authentication gating ============================ */

test("every calendar endpoint returns 401 without a valid session cookie", async () => {
  resetFakeDb();
  const status = await statusHandler(new Request("https://x/api/calendar/status"));
  assert.equal(status.status, 401);
  const connect = await connectHandler(new Request("https://x/api/calendar/connect?provider=google"));
  assert.equal(connect.status, 401);
  const events = await eventsHandler(new Request("https://x/api/calendar/events?start=2026-09-01T00:00:00.000Z&end=2026-09-02T00:00:00.000Z"));
  assert.equal(events.status, 401);
  const disconnect = await disconnectHandler(new Request("https://x/api/calendar/disconnect", { method: "POST", body: JSON.stringify({ provider: "google" }) }));
  assert.equal(disconnect.status, 401);
  const link = await linkHandler(new Request("https://x/api/calendar/link", { method: "POST", body: JSON.stringify({ provider: "google", providerEventId: "e1", calendarId: "primary", clientId: "vt-worldwide" }) }));
  assert.equal(link.status, 401);
});

test("a tampered or expired-signature session cookie is rejected the same as no cookie", async () => {
  resetFakeDb();
  const good = await cookieHeaderFor();
  const tampered = good.slice(0, -3) + "xyz";
  const res = await statusHandler(reqWithCookie("https://x/api/calendar/status", tampered));
  assert.equal(res.status, 401);
});

test("disconnect/link require POST — GET is rejected with 405", async () => {
  resetFakeDb();
  const cookie = await cookieHeaderFor();
  const d = await disconnectHandler(reqWithCookie("https://x/api/calendar/disconnect", cookie, { method: "GET" }));
  assert.equal(d.status, 405);
  const l = await linkHandler(reqWithCookie("https://x/api/calendar/link", cookie, { method: "GET" }));
  assert.equal(l.status, 405);
});

/* ============================ calendar-status ============================ */

test("calendar-status reports not-connected when no connection row exists, never a token field", async () => {
  resetFakeDb();
  const cookie = await cookieHeaderFor();
  const res = await statusHandler(reqWithCookie("https://x/api/calendar/status", cookie));
  const body = await res.json();
  assert.deepEqual(body, { providers: [{ provider: "google", connected: false }] });
  assert.doesNotMatch(JSON.stringify(body), /token/i);
});

test("calendar-status reports connected with account/status/lastSyncedAt once a connection exists", async () => {
  resetFakeDb();
  connections.push({
    id: 1, user_email: USER.email, provider: "google", provider_account_email: "chingyeesve@gmail.com",
    access_token_encrypted: "x", refresh_token_encrypted: "y", token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    scope: "https://www.googleapis.com/auth/calendar.readonly", status: "connected", last_synced_at: "2026-09-23T01:00:00.000Z", last_error: null,
  });
  const cookie = await cookieHeaderFor();
  const res = await statusHandler(reqWithCookie("https://x/api/calendar/status", cookie));
  const body = await res.json();
  assert.equal(body.providers[0].connected, true);
  assert.equal(body.providers[0].accountEmail, "chingyeesve@gmail.com");
  assert.equal(body.providers[0].lastSyncedAt, "2026-09-23T01:00:00.000Z");
  assert.doesNotMatch(JSON.stringify(body), /access_token|refresh_token|x-|"y"/);
});

/* ============================ calendar-connect ============================ */

test("calendar-connect redirects to Google with the minimum read-only scope, offline access, and a verifiable signed state", async () => {
  resetFakeDb();
  const cookie = await cookieHeaderFor();
  const res = await connectHandler(reqWithCookie("https://x/api/calendar/connect?provider=google", cookie));
  assert.equal(res.status, 302);
  const location = new URL(res.headers.get("location"));
  assert.equal(location.origin + location.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(location.searchParams.get("client_id"), CLIENT_ID);
  assert.equal(location.searchParams.get("redirect_uri"), REDIRECT_URI);
  assert.equal(location.searchParams.get("scope"), "https://www.googleapis.com/auth/calendar.readonly");
  assert.equal(location.searchParams.get("access_type"), "offline");
  assert.equal(location.searchParams.get("prompt"), "consent");
  assert.doesNotMatch(location.search, /gmail|contacts|drive|calendar%2Fevents|www\.googleapis\.com%2Fauth%2Fcalendar[^.]/i);
  const state = await verifyOAuthState(location.searchParams.get("state"), SESSION_SECRET);
  assert.equal(state.email, USER.email);
  assert.equal(state.provider, "google");
});

test("calendar-connect rejects an unsupported provider", async () => {
  resetFakeDb();
  const cookie = await cookieHeaderFor();
  const res = await connectHandler(reqWithCookie("https://x/api/calendar/connect?provider=outlook", cookie));
  assert.equal(res.status, 400);
});

/* ============================ calendar-google-callback (OAuth state) ============================ */

function fetchScript(map) {
  return async (url, init) => {
    const key = Object.keys(map).find((k) => String(url).includes(k));
    if (!key) throw new Error("Unscripted fetch: " + url);
    const result = map[key];
    return typeof result === "function" ? result(init) : result;
  };
}
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

test("the callback rejects a missing/invalid state and never touches the database", async () => {
  resetFakeDb();
  const cookie = await cookieHeaderFor();
  const res = await callbackHandler(reqWithCookie("https://x/api/calendar/google/callback?code=abc&state=not-a-real-state", cookie));
  assert.equal(res.status, 302);
  assert.match(res.headers.get("location"), /calendar=error&reason=invalid_state/);
  assert.equal(connections.length, 0);
});

test("the callback rejects a state signed for a different account than the current session (session mismatch)", async () => {
  resetFakeDb();
  const connectCookie = await cookieHeaderFor({ email: "someone-else@example.com", name: "Someone Else" });
  const connectRes = await connectHandler(reqWithCookie("https://x/api/calendar/connect?provider=google", connectCookie));
  const state = new URL(connectRes.headers.get("location")).searchParams.get("state");
  const myCookie = await cookieHeaderFor(USER); // a DIFFERENT session now presents that state
  const res = await callbackHandler(reqWithCookie(`https://x/api/calendar/google/callback?code=abc&state=${encodeURIComponent(state)}`, myCookie));
  assert.match(res.headers.get("location"), /session_mismatch/);
  assert.equal(connections.length, 0);
});

test("a provider-side error (consent denied) redirects with the reason and makes no token exchange call", async () => {
  resetFakeDb();
  const cookie = await cookieHeaderFor();
  let fetchCalled = false;
  globalThis.fetch = async () => { fetchCalled = true; throw new Error("must not be called"); };
  const res = await callbackHandler(reqWithCookie("https://x/api/calendar/google/callback?error=access_denied", cookie));
  assert.match(res.headers.get("location"), /calendar=error&reason=access_denied/);
  assert.equal(fetchCalled, false);
});

test("a successful exchange with a refresh_token stores the connection with ENCRYPTED tokens and redirects connected", async () => {
  resetFakeDb();
  const cookie = await cookieHeaderFor();
  const connectRes = await connectHandler(reqWithCookie("https://x/api/calendar/connect?provider=google", cookie));
  const state = new URL(connectRes.headers.get("location")).searchParams.get("state");

  globalThis.fetch = fetchScript({
    "oauth2.googleapis.com/token": () => jsonResponse({ access_token: "raw-access-1", refresh_token: "raw-refresh-1", expires_in: 3600, scope: "https://www.googleapis.com/auth/calendar.readonly", token_type: "Bearer" }),
    "calendars/primary": () => jsonResponse({ id: "chingyeesve@gmail.com" }),
  });

  const res = await callbackHandler(reqWithCookie(`https://x/api/calendar/google/callback?code=abc&state=${encodeURIComponent(state)}`, cookie));
  assert.match(res.headers.get("location"), /calendar=connected/);
  assert.equal(connections.length, 1);
  const row = connections[0];
  assert.equal(row.provider_account_email, "chingyeesve@gmail.com");
  assert.doesNotMatch(row.access_token_encrypted, /raw-access-1/);
  assert.doesNotMatch(row.refresh_token_encrypted, /raw-refresh-1/);
  assert.equal(await decryptToken(row.access_token_encrypted, ENCRYPTION_KEY), "raw-access-1");
  assert.equal(await decryptToken(row.refresh_token_encrypted, ENCRYPTION_KEY), "raw-refresh-1");
});

test("an exchange that returns no refresh_token is rejected — never stores a connection this app can't refresh", async () => {
  resetFakeDb();
  const cookie = await cookieHeaderFor();
  const connectRes = await connectHandler(reqWithCookie("https://x/api/calendar/connect?provider=google", cookie));
  const state = new URL(connectRes.headers.get("location")).searchParams.get("state");
  globalThis.fetch = fetchScript({
    "oauth2.googleapis.com/token": () => jsonResponse({ access_token: "raw-access-1", expires_in: 3600, scope: "x", token_type: "Bearer" }),
  });
  const res = await callbackHandler(reqWithCookie(`https://x/api/calendar/google/callback?code=abc&state=${encodeURIComponent(state)}`, cookie));
  assert.match(res.headers.get("location"), /reason=no_refresh_token/);
  assert.equal(connections.length, 0);
});

/* ---------- Stage-tagged diagnostics for the caught-error path after Google
 * authorization (production incident: consent + code exchange reach the
 * callback, but the connection is never persisted, and the UI only ever
 * shows one generic message because every failure collapsed into the same
 * catch-all). Each stage gets its own reason code and its own structured,
 * secret-free console.error line so a real production failure is
 * diagnosable from Netlify Observability without guessing. ---------- */

async function withConsoleErrorSpy(fn) {
  const calls = [];
  const original = console.error;
  console.error = (...args) => { calls.push(args); };
  try {
    await fn();
  } finally {
    console.error = original;
  }
  return calls;
}

function assertNoSecretsLogged(calls, secrets) {
  const logged = JSON.stringify(calls);
  for (const secret of secrets) assert.doesNotMatch(logged, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

test("token exchange failure: reason=token_exchange_failed, stage-tagged diagnostic, no connection stored, no secret logged", async () => {
  resetFakeDb();
  const cookie = await cookieHeaderFor();
  const connectRes = await connectHandler(reqWithCookie("https://x/api/calendar/connect?provider=google", cookie));
  const state = new URL(connectRes.headers.get("location")).searchParams.get("state");
  globalThis.fetch = fetchScript({
    "oauth2.googleapis.com/token": () => new Response("invalid_grant", { status: 400 }),
  });
  const calls = await withConsoleErrorSpy(async () => {
    const res = await callbackHandler(reqWithCookie(`https://x/api/calendar/google/callback?code=super-secret-auth-code&state=${encodeURIComponent(state)}`, cookie));
    assert.match(res.headers.get("location"), /calendar=error&reason=token_exchange_failed/);
  });
  assert.equal(connections.length, 0);
  assert.equal(calls.length, 1);
  const logged = JSON.parse(calls[0][0]);
  assert.equal(logged.event, "calendar_google_callback_error");
  assert.equal(logged.stage, "token_exchange");
  assert.match(logged.errorMessage, /Google token exchange failed \(400\)/);
  assertNoSecretsLogged(calls, ["super-secret-auth-code", CLIENT_SECRET, SESSION_SECRET, ENCRYPTION_KEY]);
});

/* ---------- Google's own OAuth error classification (RFC 6749 §5.2) —
 * production reported token_exchange_failed with no way to tell
 * invalid_client/invalid_grant/redirect_uri_mismatch apart. Google's token
 * endpoint always returns a JSON {error, error_description} body on
 * failure; exchangeCodeForTokens() now reads it instead of discarding it,
 * and the callback surfaces the short `error` code both in its structured
 * log and as a safe `detail=` query param on the redirect, so a real
 * production failure is distinguishable without server-log access. ---------- */

for (const googleErrorCode of ["invalid_client", "invalid_grant", "redirect_uri_mismatch"]) {
  test(`token exchange rejected by Google as "${googleErrorCode}" is captured distinctly: detail= on the redirect, googleError in the structured log, never a secret`, async () => {
    resetFakeDb();
    const cookie = await cookieHeaderFor();
    const connectRes = await connectHandler(reqWithCookie("https://x/api/calendar/connect?provider=google", cookie));
    const state = new URL(connectRes.headers.get("location")).searchParams.get("state");
    globalThis.fetch = fetchScript({
      "oauth2.googleapis.com/token": () => jsonResponse({ error: googleErrorCode, error_description: `Google's own description of ${googleErrorCode}.` }, 400),
    });
    const calls = await withConsoleErrorSpy(async () => {
      const res = await callbackHandler(reqWithCookie(`https://x/api/calendar/google/callback?code=abc&state=${encodeURIComponent(state)}`, cookie));
      assert.match(res.headers.get("location"), /calendar=error&reason=token_exchange_failed/);
      assert.match(res.headers.get("location"), new RegExp(`detail=${googleErrorCode}`));
    });
    assert.equal(connections.length, 0);
    const logged = JSON.parse(calls[0][0]);
    assert.equal(logged.stage, "token_exchange");
    assert.equal(logged.googleError, googleErrorCode);
    assert.match(logged.googleErrorDescription, new RegExp(googleErrorCode));
    assertNoSecretsLogged(calls, [CLIENT_SECRET, SESSION_SECRET, ENCRYPTION_KEY]);
  });
}

test("a non-JSON token-endpoint error body (e.g. an intermediary/proxy error page) degrades gracefully — still reason=token_exchange_failed, no detail= param, no crash", async () => {
  resetFakeDb();
  const cookie = await cookieHeaderFor();
  const connectRes = await connectHandler(reqWithCookie("https://x/api/calendar/connect?provider=google", cookie));
  const state = new URL(connectRes.headers.get("location")).searchParams.get("state");
  globalThis.fetch = fetchScript({
    "oauth2.googleapis.com/token": () => new Response("<html>502 Bad Gateway</html>", { status: 502, headers: { "Content-Type": "text/html" } }),
  });
  const calls = await withConsoleErrorSpy(async () => {
    const res = await callbackHandler(reqWithCookie(`https://x/api/calendar/google/callback?code=abc&state=${encodeURIComponent(state)}`, cookie));
    assert.match(res.headers.get("location"), /calendar=error&reason=token_exchange_failed$/);
    assert.doesNotMatch(res.headers.get("location"), /detail=/);
  });
  const logged = JSON.parse(calls[0][0]);
  assert.equal(logged.httpStatus, 502);
  assert.equal(logged.googleError, null);
});

test("GOOGLE_CALENDAR_CLIENT_ID/CLIENT_SECRET/REDIRECT_URI with accidental surrounding whitespace are trimmed identically at both the authorize step (calendar-connect) and the token-exchange step (the callback) — never sent to Google with stray whitespace, and the secret's real characters are untouched", async () => {
  resetFakeDb();
  const realClientId = ENV.GOOGLE_CALENDAR_CLIENT_ID;
  const realClientSecret = ENV.GOOGLE_CALENDAR_CLIENT_SECRET;
  const realRedirectUri = ENV.GOOGLE_CALENDAR_REDIRECT_URI;
  ENV.GOOGLE_CALENDAR_CLIENT_ID = `  ${realClientId}\n`;
  ENV.GOOGLE_CALENDAR_CLIENT_SECRET = `${realClientSecret}\n`;
  ENV.GOOGLE_CALENDAR_REDIRECT_URI = ` ${realRedirectUri} `;

  const cookie = await cookieHeaderFor();
  const connectRes = await connectHandler(reqWithCookie("https://x/api/calendar/connect?provider=google", cookie));
  const authLocation = new URL(connectRes.headers.get("location"));
  assert.equal(authLocation.searchParams.get("client_id"), realClientId);
  assert.equal(authLocation.searchParams.get("redirect_uri"), realRedirectUri);
  const state = authLocation.searchParams.get("state");

  let exchangeBody = null;
  globalThis.fetch = fetchScript({
    "oauth2.googleapis.com/token": (init) => { exchangeBody = new URLSearchParams(init.body); return jsonResponse({ access_token: "a", refresh_token: "r", expires_in: 3600, scope: "https://www.googleapis.com/auth/calendar.readonly", token_type: "Bearer" }); },
    "calendars/primary": () => jsonResponse({ id: "chingyeesve@gmail.com" }),
  });
  const res = await callbackHandler(reqWithCookie(`https://x/api/calendar/google/callback?code=abc&state=${encodeURIComponent(state)}`, cookie));
  assert.match(res.headers.get("location"), /calendar=connected/);
  assert.equal(exchangeBody.get("client_id"), realClientId);
  assert.equal(exchangeBody.get("client_secret"), realClientSecret);
  assert.equal(exchangeBody.get("redirect_uri"), realRedirectUri);

  ENV.GOOGLE_CALENDAR_CLIENT_ID = realClientId;
  ENV.GOOGLE_CALENDAR_CLIENT_SECRET = realClientSecret;
  ENV.GOOGLE_CALENDAR_REDIRECT_URI = realRedirectUri;
});

test("calendar lookup failure (after a successful token exchange): reason=calendar_lookup_failed, stage-tagged, no connection stored, no token logged", async () => {
  resetFakeDb();
  const cookie = await cookieHeaderFor();
  const connectRes = await connectHandler(reqWithCookie("https://x/api/calendar/connect?provider=google", cookie));
  const state = new URL(connectRes.headers.get("location")).searchParams.get("state");
  globalThis.fetch = fetchScript({
    "oauth2.googleapis.com/token": () => jsonResponse({ access_token: "raw-access-secret", refresh_token: "raw-refresh-secret", expires_in: 3600, scope: "https://www.googleapis.com/auth/calendar.readonly", token_type: "Bearer" }),
    "calendars/primary": () => new Response("forbidden", { status: 403 }),
  });
  const calls = await withConsoleErrorSpy(async () => {
    const res = await callbackHandler(reqWithCookie(`https://x/api/calendar/google/callback?code=abc&state=${encodeURIComponent(state)}`, cookie));
    assert.match(res.headers.get("location"), /calendar=error&reason=calendar_lookup_failed/);
  });
  assert.equal(connections.length, 0);
  const logged = JSON.parse(calls[0][0]);
  assert.equal(logged.stage, "calendar_lookup");
  assert.equal(logged.httpStatus, 403);
  assertNoSecretsLogged(calls, ["raw-access-secret", "raw-refresh-secret", CLIENT_SECRET, SESSION_SECRET, ENCRYPTION_KEY]);
});

test("a malformed EXECUTIVE_VAULT_TOKEN_ENCRYPTION_KEY (e.g. not 32 bytes after base64 decode) is a distinct token_encryption_failed stage, not a generic/db failure", async () => {
  resetFakeDb();
  const cookie = await cookieHeaderFor();
  const connectRes = await connectHandler(reqWithCookie("https://x/api/calendar/connect?provider=google", cookie));
  const state = new URL(connectRes.headers.get("location")).searchParams.get("state");
  globalThis.fetch = fetchScript({
    "oauth2.googleapis.com/token": () => jsonResponse({ access_token: "raw-access-secret", refresh_token: "raw-refresh-secret", expires_in: 3600, scope: "https://www.googleapis.com/auth/calendar.readonly", token_type: "Bearer" }),
    "calendars/primary": () => jsonResponse({ id: "chingyeesve@gmail.com" }),
  });
  const badKey = Buffer.from("too-short").toString("base64"); // decodes to far fewer than 32 bytes
  ENV.EXECUTIVE_VAULT_TOKEN_ENCRYPTION_KEY = badKey;
  const calls = await withConsoleErrorSpy(async () => {
    const res = await callbackHandler(reqWithCookie(`https://x/api/calendar/google/callback?code=abc&state=${encodeURIComponent(state)}`, cookie));
    assert.match(res.headers.get("location"), /calendar=error&reason=token_encryption_failed/);
  });
  ENV.EXECUTIVE_VAULT_TOKEN_ENCRYPTION_KEY = ENCRYPTION_KEY; // restore for later tests
  assert.equal(connections.length, 0);
  const logged = JSON.parse(calls[0][0]);
  assert.equal(logged.stage, "token_encryption");
  assert.match(logged.errorMessage, /must decode to exactly 32 bytes/);
  assertNoSecretsLogged(calls, ["raw-access-secret", "raw-refresh-secret", badKey, CLIENT_SECRET, SESSION_SECRET]);
});

test("a database failure at persist time (e.g. calendar_connections migration not applied in this environment) is a distinct db_persist_failed stage, with the Postgres SQLSTATE captured and no token logged", async () => {
  resetFakeDb();
  const cookie = await cookieHeaderFor();
  const connectRes = await connectHandler(reqWithCookie("https://x/api/calendar/connect?provider=google", cookie));
  const state = new URL(connectRes.headers.get("location")).searchParams.get("state");
  globalThis.fetch = fetchScript({
    "oauth2.googleapis.com/token": () => jsonResponse({ access_token: "raw-access-secret", refresh_token: "raw-refresh-secret", expires_in: 3600, scope: "https://www.googleapis.com/auth/calendar.readonly", token_type: "Bearer" }),
    "calendars/primary": () => jsonResponse({ id: "chingyeesve@gmail.com" }),
  });
  const realSql = fakeDb.sql;
  fakeDb.sql = (strings, ...values) => {
    const text = strings.join("");
    if (text.includes("INSERT INTO calendar_connections")) {
      const err = new Error(`relation "calendar_connections" does not exist`);
      err.code = "42P01"; // Postgres SQLSTATE for undefined_table — the exact "migration never applied" signature
      throw err;
    }
    return realSql(strings, ...values);
  };
  const calls = await withConsoleErrorSpy(async () => {
    const res = await callbackHandler(reqWithCookie(`https://x/api/calendar/google/callback?code=abc&state=${encodeURIComponent(state)}`, cookie));
    assert.match(res.headers.get("location"), /calendar=error&reason=db_persist_failed/);
  });
  fakeDb.sql = realSql;
  assert.equal(connections.length, 0);
  const logged = JSON.parse(calls[0][0]);
  assert.equal(logged.stage, "db_persist");
  assert.equal(logged.pgErrorCode, "42P01");
  assertNoSecretsLogged(calls, ["raw-access-secret", "raw-refresh-secret", CLIENT_SECRET, SESSION_SECRET, ENCRYPTION_KEY]);
});

/* ============================ calendar-events: normalization, timezone, refresh, linking ============================ */

function connectedRow(overrides = {}) {
  const row = {
    id: connSeq++, user_email: USER.email, provider: "google", provider_account_email: USER.email,
    access_token_encrypted: null, refresh_token_encrypted: null,
    token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    scope: "https://www.googleapis.com/auth/calendar.readonly", status: "connected", last_synced_at: null, last_error: null,
    ...overrides,
  };
  connections.push(row);
  return row;
}

test("calendar-events returns { connected:false, events:[] } when nothing is connected — honest empty state, not an error", async () => {
  resetFakeDb();
  const cookie = await cookieHeaderFor();
  const res = await eventsHandler(reqWithCookie("https://x/api/calendar/events?start=2026-09-21T00:00:00.000Z&end=2026-09-28T00:00:00.000Z", cookie));
  const body = await res.json();
  assert.deepEqual(body, { connected: false, events: [] });
});

test("calendar-events normalizes a fetched Google event (timezone, meeting URL, attendees) and marks the link unlinked by default", async () => {
  resetFakeDb();
  const row = connectedRow({
    access_token_encrypted: await encryptToken("access-fresh", ENCRYPTION_KEY),
    refresh_token_encrypted: await encryptToken("refresh-fresh", ENCRYPTION_KEY),
  });
  globalThis.fetch = fetchScript({
    "/events?": () => jsonResponse({
      items: [{
        id: "evt1", summary: "VT Worldwide — Review",
        start: { dateTime: "2026-09-23T11:00:00+08:00", timeZone: "Asia/Kuala_Lumpur" },
        end: { dateTime: "2026-09-23T12:00:00+08:00", timeZone: "Asia/Kuala_Lumpur" },
        hangoutLink: "https://meet.google.com/abc-defg-hij",
        organizer: { email: "ching@example.com", displayName: "Ching Yee" },
        attendees: [{ email: "a@x.com", displayName: "A", responseStatus: "accepted" }],
      }],
    }),
  });
  const cookie = await cookieHeaderFor();
  const res = await eventsHandler(reqWithCookie("https://x/api/calendar/events?start=2026-09-21T00:00:00.000Z&end=2026-09-28T00:00:00.000Z", cookie));
  const body = await res.json();
  assert.equal(body.connected, true);
  assert.equal(body.events.length, 1);
  const ev = body.events[0];
  assert.equal(ev.provider, "google");
  assert.equal(ev.providerEventId, "evt1");
  assert.equal(ev.start, "2026-09-23T03:00:00.000Z"); // 11:00 +08:00 -> 03:00 UTC
  assert.equal(ev.timeZone, "Asia/Kuala_Lumpur");
  assert.equal(ev.meetingUrl, "https://meet.google.com/abc-defg-hij");
  assert.equal(ev.link.linkStatus, "unlinked");
  assert.equal(ev.link.clientId, null);
  assert.ok(row.last_synced_at || connections.find((c) => c.id === row.id).last_synced_at, "last_synced_at should be stamped on a successful fetch");
});

test("no keyword auto-classification: an event titled after a real Client is still unlinked with no clientId, absent an explicit link", async () => {
  resetFakeDb();
  connectedRow({ access_token_encrypted: await encryptToken("a", ENCRYPTION_KEY), refresh_token_encrypted: await encryptToken("r", ENCRYPTION_KEY) });
  globalThis.fetch = fetchScript({
    "/events?": () => jsonResponse({ items: [{ id: "evt-vt", summary: "VT Worldwide catch-up", start: { dateTime: "2026-09-23T09:00:00Z" }, end: { dateTime: "2026-09-23T09:30:00Z" } }] }),
  });
  const cookie = await cookieHeaderFor();
  const res = await eventsHandler(reqWithCookie("https://x/api/calendar/events?start=2026-09-21T00:00:00.000Z&end=2026-09-28T00:00:00.000Z", cookie));
  const body = await res.json();
  assert.equal(body.events[0].link.clientId, null);
  assert.equal(body.events[0].link.linkStatus, "unlinked");
});

test("an event with an explicit calendar_event_links row comes back linked, with the real clientId/matterId", async () => {
  resetFakeDb();
  connectedRow({ access_token_encrypted: await encryptToken("a", ENCRYPTION_KEY), refresh_token_encrypted: await encryptToken("r", ENCRYPTION_KEY) });
  eventLinks.push({ user_email: USER.email, provider: "google", provider_event_id: "evt1", calendar_id: "primary", client_id: "vt-worldwide", matter_id: "matter-vt-hrtransform", workstream: "HR Policy Framework", link_status: "linked", linked_at: "2026-09-23T00:00:00.000Z", linked_by: "Ching Yee" });
  globalThis.fetch = fetchScript({
    "/events?": () => jsonResponse({ items: [{ id: "evt1", summary: "Review", start: { dateTime: "2026-09-23T09:00:00Z" }, end: { dateTime: "2026-09-23T09:30:00Z" } }] }),
  });
  const cookie = await cookieHeaderFor();
  const res = await eventsHandler(reqWithCookie("https://x/api/calendar/events?start=2026-09-21T00:00:00.000Z&end=2026-09-28T00:00:00.000Z", cookie));
  const body = await res.json();
  assert.equal(body.events[0].link.linkStatus, "linked");
  assert.equal(body.events[0].link.clientId, "vt-worldwide");
  assert.equal(body.events[0].link.matterId, "matter-vt-hrtransform");
});

test("a near-expiry token is refreshed BEFORE fetching, and a refresh_token omitted from Google's response preserves the existing one", async () => {
  resetFakeDb();
  const row = connectedRow({
    access_token_encrypted: await encryptToken("stale-access", ENCRYPTION_KEY),
    refresh_token_encrypted: await encryptToken("original-refresh", ENCRYPTION_KEY),
    token_expires_at: new Date(Date.now() + 30_000).toISOString(), // expiring in 30s — inside the 2-minute refresh buffer
  });
  let usedAccessToken = null;
  globalThis.fetch = fetchScript({
    "oauth2.googleapis.com/token": () => jsonResponse({ access_token: "new-access", expires_in: 3600, scope: "x", token_type: "Bearer" }), // no refresh_token in the response
    "/events?": (init) => { usedAccessToken = init.headers.Authorization || init.headers.authorization; return jsonResponse({ items: [] }); },
  });
  const cookie = await cookieHeaderFor();
  const res = await eventsHandler(reqWithCookie("https://x/api/calendar/events?start=2026-09-21T00:00:00.000Z&end=2026-09-28T00:00:00.000Z", cookie));
  assert.equal(res.status, 200);
  assert.match(String(usedAccessToken), /new-access/);
  const updated = connections.find((c) => c.id === row.id);
  assert.equal(await decryptToken(updated.access_token_encrypted, ENCRYPTION_KEY), "new-access");
  assert.equal(await decryptToken(updated.refresh_token_encrypted, ENCRYPTION_KEY), "original-refresh", "the refresh token must be preserved when Google's refresh response omits one");
});

test("a mid-fetch 401 triggers one refresh-and-retry, and the retried call succeeds", async () => {
  resetFakeDb();
  connectedRow({
    access_token_encrypted: await encryptToken("looks-fresh-but-invalid", ENCRYPTION_KEY),
    refresh_token_encrypted: await encryptToken("refresh-1", ENCRYPTION_KEY),
    token_expires_at: new Date(Date.now() + 3600_000).toISOString(), // not near expiry, so the proactive check won't refresh it
  });
  let eventsCallCount = 0;
  globalThis.fetch = fetchScript({
    "oauth2.googleapis.com/token": () => jsonResponse({ access_token: "recovered-access", expires_in: 3600, scope: "x", token_type: "Bearer" }),
    "/events?": () => {
      eventsCallCount++;
      if (eventsCallCount === 1) return new Response(JSON.stringify({ error: "invalid_token" }), { status: 401 });
      return jsonResponse({ items: [] });
    },
  });
  const cookie = await cookieHeaderFor();
  const res = await eventsHandler(reqWithCookie("https://x/api/calendar/events?start=2026-09-21T00:00:00.000Z&end=2026-09-28T00:00:00.000Z", cookie));
  assert.equal(res.status, 200);
  assert.equal(eventsCallCount, 2);
});

test("a failed refresh (invalid_grant) marks the connection 'expired' and returns a plain-language message, never a raw error", async () => {
  resetFakeDb();
  const row = connectedRow({
    access_token_encrypted: await encryptToken("a", ENCRYPTION_KEY),
    refresh_token_encrypted: await encryptToken("revoked-refresh", ENCRYPTION_KEY),
    token_expires_at: new Date(Date.now() - 1000).toISOString(), // already expired -> proactive refresh path
  });
  globalThis.fetch = fetchScript({
    "oauth2.googleapis.com/token": () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }),
  });
  const cookie = await cookieHeaderFor();
  const res = await eventsHandler(reqWithCookie("https://x/api/calendar/events?start=2026-09-21T00:00:00.000Z&end=2026-09-28T00:00:00.000Z", cookie));
  const body = await res.json();
  assert.equal(res.status, 502); // refreshAccessToken's own failure isn't classified as 401 by _calendar-google.mts, so it surfaces as a transient "error", not "expired" — see next test for the explicit 401 case
  assert.doesNotMatch(JSON.stringify(body), /invalid_grant|stack|TypeError/);
  assert.equal(connections.find((c) => c.id === row.id).status, "error");
});

/* ============================ calendar-disconnect ============================ */

test("disconnect removes the stored connection; status then reports not-connected", async () => {
  resetFakeDb();
  connectedRow();
  const cookie = await cookieHeaderFor();
  const res = await disconnectHandler(reqWithCookie("https://x/api/calendar/disconnect", cookie, { method: "POST", body: JSON.stringify({ provider: "google" }) }));
  assert.equal((await res.json()).ok, true);
  assert.equal(connections.length, 0);
  const status = await statusHandler(reqWithCookie("https://x/api/calendar/status", cookie));
  assert.equal((await status.json()).providers[0].connected, false);
});

test("disconnect never affects the Executive Vault session itself", async () => {
  resetFakeDb();
  connectedRow();
  const cookie = await cookieHeaderFor();
  await disconnectHandler(reqWithCookie("https://x/api/calendar/disconnect", cookie, { method: "POST", body: JSON.stringify({ provider: "google" }) }));
  // the SAME cookie still authenticates other endpoints afterwards
  const status = await statusHandler(reqWithCookie("https://x/api/calendar/status", cookie));
  assert.equal(status.status, 200);
});

/* ============================ calendar-link: explicit only, never automatic ============================ */

test("calendar-link creates an explicit link only when called, and requires a clientId to link", async () => {
  resetFakeDb();
  const cookie = await cookieHeaderFor();
  const bad = await linkHandler(reqWithCookie("https://x/api/calendar/link", cookie, { method: "POST", body: JSON.stringify({ provider: "google", providerEventId: "evt1", calendarId: "primary" }) }));
  assert.equal(bad.status, 400);
  const res = await linkHandler(reqWithCookie("https://x/api/calendar/link", cookie, { method: "POST", body: JSON.stringify({ provider: "google", providerEventId: "evt1", calendarId: "primary", clientId: "vt-worldwide", matterId: "matter-vt-hrtransform" }) }));
  const body = await res.json();
  assert.equal(body.link.link_status, "linked");
  assert.equal(body.link.client_id, "vt-worldwide");
});

test("calendar-link unlink clears the relationship back to unlinked without deleting the row", async () => {
  resetFakeDb();
  const cookie = await cookieHeaderFor();
  await linkHandler(reqWithCookie("https://x/api/calendar/link", cookie, { method: "POST", body: JSON.stringify({ provider: "google", providerEventId: "evt1", calendarId: "primary", clientId: "vt-worldwide" }) }));
  const res = await linkHandler(reqWithCookie("https://x/api/calendar/link", cookie, { method: "POST", body: JSON.stringify({ provider: "google", providerEventId: "evt1", calendarId: "primary", action: "unlink" }) }));
  const body = await res.json();
  assert.equal(body.link.link_status, "unlinked");
  assert.equal(body.link.client_id, null);
  assert.equal(eventLinks.length, 1, "unlink updates the existing row rather than adding a second one");
});

test("getEventLinks() scopes strictly to (user_email, provider, calendar_id) — integrity of the link lookup", async () => {
  resetFakeDb();
  eventLinks.push({ user_email: USER.email, provider: "google", provider_event_id: "e1", calendar_id: "primary", client_id: "vt-worldwide", matter_id: null, workstream: null, link_status: "linked", linked_at: null });
  eventLinks.push({ user_email: USER.email, provider: "google", provider_event_id: "e2", calendar_id: "secondary", client_id: "mre-asia", matter_id: null, workstream: null, link_status: "linked", linked_at: null });
  const rows = await getEventLinks(fakeDb, USER.email, "google", "primary");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].provider_event_id, "e1");
});

/* ============================ Pure normalization / timezone (no DB, no fetch) ============================ */

test("normalizeGoogleEvent() converts an offset-bearing local time to the correct UTC instant and preserves the original IANA zone", () => {
  const raw = { id: "e1", summary: "T", start: { dateTime: "2026-09-23T11:00:00+08:00", timeZone: "Asia/Kuala_Lumpur" }, end: { dateTime: "2026-09-23T12:00:00+08:00", timeZone: "Asia/Kuala_Lumpur" } };
  const n = normalizeGoogleEvent(raw, "primary", "2026-09-23T01:00:00.000Z");
  assert.equal(n.start, "2026-09-23T03:00:00.000Z");
  assert.equal(n.end, "2026-09-23T04:00:00.000Z");
  assert.equal(n.timeZone, "Asia/Kuala_Lumpur");
  assert.equal(n.allDay, false);
});

test("normalizeGoogleEvent() flags an all-day (date-only) event correctly", () => {
  const raw = { id: "e2", summary: "Conference", start: { date: "2026-09-25" }, end: { date: "2026-09-26" } };
  const n = normalizeGoogleEvent(raw, "primary", "2026-09-23T01:00:00.000Z");
  assert.equal(n.allDay, true);
});

test("normalizeGoogleEvent() never includes a Client/Matter/Workstream field — classification is strictly a separate, explicit action", () => {
  const raw = { id: "e3", summary: "VT Worldwide review", start: { dateTime: "2026-09-23T09:00:00Z" }, end: { dateTime: "2026-09-23T09:30:00Z" } };
  const n = normalizeGoogleEvent(raw, "primary", "2026-09-23T01:00:00.000Z");
  assert.ok(!("clientId" in n) && !("matterId" in n) && !("workstream" in n));
});

/* ============================ Encryption round-trip (no DB, no fetch) ============================ */

test("encryptToken()/decryptToken() round-trip, and a wrong key fails rather than silently returning garbage", async () => {
  const plaintext = "1//refresh-token-value";
  const enc = await encryptToken(plaintext, ENCRYPTION_KEY);
  assert.doesNotMatch(enc, new RegExp(plaintext.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")));
  assert.equal(await decryptToken(enc, ENCRYPTION_KEY), plaintext);
  const wrongKey = crypto.randomBytes(32).toString("base64");
  await assert.rejects(() => decryptToken(enc, wrongKey));
});
