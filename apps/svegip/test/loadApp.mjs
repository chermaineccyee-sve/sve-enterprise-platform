/**
 * PR #11: a minimal sandbox for exercising apps/svegip/app.js's own,
 * unmodified pure navigation/permission logic (portalAllowed,
 * SVEGIP_ACCESS_POLICY, HRMS_ACTIVES, permittedNav, nav) from node:test,
 * without a browser. app.js is a classic (non-module) script written to
 * run directly in a page, so this loads it into a vm context with the
 * minimal DOM/fetch/window surface it touches at load time (a synchronous
 * render() call into a stub #app element, then a fire-and-forget
 * bootstrapAuth() whose fetch("/api/session") is stubbed to resolve
 * unauthenticated) — no real network, no real browser. Every test below
 * asserts against the SAME functions this file actually ships, not a
 * reimplementation of the nav-gating rules.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_JS_PATH = path.join(__dirname, "..", "app.js");

function makeStubElement() {
  const el = {
    innerHTML: "",
    classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
    style: {},
    insertAdjacentHTML() {},
    prepend() {},
    appendChild() {},
    querySelector() { return null; },
    scrollIntoView() {},
    addEventListener() {},
    remove() {},
  };
  return el;
}

/**
 * Loads a fresh copy of app.js into an isolated, contextified sandbox
 * object and returns that SAME object (vm.createContext contextifies its
 * argument in place rather than returning a new one). Top-level
 * `function` declarations in app.js (portalAllowed, permittedNav, nav,
 * bootstrapAuth, ...) attach to this object as callable properties;
 * top-level `let`/`const` bindings (session, SVEGIP_ACCESS_POLICY,
 * HRMS_ACTIVES, ...) do NOT — by design, those stay purely lexical, the
 * same as in a real browser's top-level script scope. Tests that need to
 * change `session` do so the same way the real app does: by reassigning
 * `sandbox.fetch` (an ordinary mutable property both the script and the
 * test see) to control what `/api/session` resolves to, then calling the
 * exposed `bootstrapAuth()` function, which assigns the closed-over
 * `session` binding internally.
 */
export function loadApp() {
  const source = fs.readFileSync(APP_JS_PATH, "utf8");
  const sandbox = {
    console,
    fetch: async () => ({ ok: false, status: 401, json: async () => ({}) }),
    location: { href: "", replace() {}, search: "", pathname: "/" },
    document: {
      getElementById() { return makeStubElement(); },
      querySelector() { return null; },
      createElement() { return makeStubElement(); },
      body: { insertAdjacentHTML() {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, contains() { return true; } },
      addEventListener() {},
    },
    URLSearchParams,
    URL,
    structuredClone,
    // Real timers are deliberately NOT wired in: app.js's home() screen
    // schedules a real-clock display via a recursive setTimeout
    // (updateGroupHomeClock) that would otherwise keep this sandbox's
    // event loop alive forever. No test here exercises time-based
    // behavior, so these are inert no-ops.
    setTimeout() { return 0; },
    clearTimeout() {},
    setInterval() { return 0; },
    clearInterval() {},
    alert() {},
    confirm() { return true; },
    prompt() { return null; },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "app.js" });
  return sandbox;
}

/** Configures the sandbox's stubbed /api/session to resolve as the given SVEGIP user, then runs the real bootstrapAuth() so app.js's own closed-over `session` binding is set exactly as it would be after a real login — no test-only reimplementation of that assignment. */
export async function signIn(app, user) {
  app.fetch = async (url) => {
    if (String(url).startsWith("/api/session")) return { ok: true, status: 200, json: async () => ({ user }) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  await app.bootstrapAuth();
}
