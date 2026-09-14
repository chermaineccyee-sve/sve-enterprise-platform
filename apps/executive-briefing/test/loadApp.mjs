/**
 * A minimal sandbox for exercising apps/executive-briefing/app.js's own,
 * unmodified functions (goToScreen, nextScreen, selectStage, selectModule,
 * getModuleStatus, ...) from node:test, without a browser. app.js is a
 * classic (non-module) script written to run directly in a page, so this
 * loads it into a vm context with the minimal DOM surface it touches at
 * load time (a synchronous init() call into a stub #app element) — no real
 * network, no real browser. Mirrors apps/svegip/test/loadApp.mjs's
 * technique; this app has no auth/session, so there is no signIn() here.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_JS_PATH = path.join(__dirname, "..", "app.js");

function makeStubElement() {
  const listeners = {};
  return {
    innerHTML: "",
    addEventListener(type, fn) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    dispatch(type, evt) {
      (listeners[type] || []).forEach((fn) => fn(evt));
    },
  };
}

export function loadApp() {
  const source = fs.readFileSync(APP_JS_PATH, "utf8");
  const appEl = makeStubElement();
  const docListeners = {};
  const sandbox = {
    console,
    document: {
      getElementById(id) {
        return id === "app" ? appEl : null;
      },
      addEventListener(type, fn) {
        docListeners[type] = docListeners[type] || [];
        docListeners[type].push(fn);
      },
    },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "app.js" });
  return sandbox;
}
