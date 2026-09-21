import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./loadApp.mjs";

test("the test sandbox bootstraps as authenticated (no server to check a session against), so every existing screen test keeps working unmodified", () => {
  const sandbox = loadApp();
  assert.doesNotMatch(sandbox.__appEl.innerHTML, /Sign In/);
});

test("renderLoginScreen() identifies the Command Centre as belonging to Ching Yee, asks only for this app's own email/password, and never mentions Microsoft/Outlook", () => {
  const sandbox = loadApp();
  const html = sandbox.renderLoginScreen();
  assert.match(html, /Personal Executive Command Centre — Ching Yee/);
  assert.match(html, /type="email"/);
  assert.match(html, /type="password"/);
  assert.doesNotMatch(html, /Microsoft/i);
  assert.doesNotMatch(html, /Outlook/i);
});

test("render() re-shows the login screen instead of the app shell once signed out, even after a subsequent navigation", async () => {
  const sandbox = loadApp();
  sandbox.navigate("#/home");
  assert.doesNotMatch(sandbox.__appEl.innerHTML, /Sign In/);
  await sandbox.signOut();
  assert.match(sandbox.__appEl.innerHTML, /Sign In/);
  sandbox.navigate("#/home"); // a hashchange firing while logged out must not leak the app shell
  assert.match(sandbox.__appEl.innerHTML, /Sign In/);
});

test("submitLogin() on success authenticates, closes the login screen, and personalises the greeting with the real signed-in name", async () => {
  const sandbox = loadApp();
  await sandbox.signOut();
  sandbox.fetch = async (url, opts) => {
    assert.equal(url, "/api/login");
    assert.equal(opts.method, "POST");
    const body = JSON.parse(opts.body);
    assert.equal(body.email, "chingyeesve@gmail.com");
    return { ok: true, json: async () => ({ ok: true, user: { email: "chingyeesve@gmail.com", name: "Ching Yee" } }) };
  };
  await sandbox.submitLogin("chingyeesve@gmail.com", "a-real-password");
  const html = sandbox.__appEl.innerHTML;
  assert.doesNotMatch(html, /Sign In/);
  assert.match(html, /Ching Yee/);
});

test("submitLogin() on invalid credentials shows the server's own error message and stays on the login screen", async () => {
  const sandbox = loadApp();
  await sandbox.signOut();
  sandbox.fetch = async () => ({ ok: false, json: async () => ({ error: "Invalid email or password." }) });
  await sandbox.submitLogin("chingyeesve@gmail.com", "wrong-password");
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, /Invalid email or password\./);
  assert.match(html, /Sign In/);
});

test("submitLogin() never sends a Microsoft credential and the request body carries only email/password", async () => {
  const sandbox = loadApp();
  await sandbox.signOut();
  let capturedBody = null;
  sandbox.fetch = async (url, opts) => {
    capturedBody = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ ok: true, user: { email: "chingyeesve@gmail.com", name: "Ching Yee" } }) };
  };
  await sandbox.submitLogin("chingyeesve@gmail.com", "a-real-password");
  assert.deepEqual(Object.keys(capturedBody).sort(), ["email", "password"]);
});

test("submitLogin() on a network/connection failure shows a generic reachability error, not a raw exception", async () => {
  const sandbox = loadApp();
  await sandbox.signOut();
  // No fetch stub at all here — mirrors a real network failure and confirms
  // the catch path (not just the ok:false path) also lands safely on the
  // login screen with an explanatory message.
  await sandbox.submitLogin("chingyeesve@gmail.com", "whatever");
  assert.match(sandbox.__appEl.innerHTML, /Unable to reach the Command Centre/);
});

test("the topbar shows the signed-in user's initials and a Sign Out control naming who is signed in", async () => {
  const sandbox = loadApp();
  await sandbox.signOut();
  sandbox.fetch = async () => ({ ok: true, json: async () => ({ ok: true, user: { email: "chingyeesve@gmail.com", name: "Ching Yee" } }) });
  await sandbox.submitLogin("chingyeesve@gmail.com", "a-real-password");
  sandbox.toggleUserMenu();
  const html = sandbox.__appEl.innerHTML;
  assert.match(html, />CY</);
  assert.match(html, /Sign Out/);
  assert.match(html, /chingyeesve@gmail\.com/);
});

test("signOut() clears the signed-in user so a subsequent render never leaks their name", async () => {
  const sandbox = loadApp();
  await sandbox.signOut();
  sandbox.fetch = async () => ({ ok: true, json: async () => ({ ok: true, user: { email: "chingyeesve@gmail.com", name: "Ching Yee" } }) });
  await sandbox.submitLogin("chingyeesve@gmail.com", "a-real-password");
  assert.match(sandbox.__appEl.innerHTML, /Ching Yee/);
  await sandbox.signOut();
  assert.match(sandbox.__appEl.innerHTML, /Sign In/);
});
