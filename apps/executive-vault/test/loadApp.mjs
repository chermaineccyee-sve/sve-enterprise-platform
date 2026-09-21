/**
 * Minimal sandbox for exercising data.js + app.js's own, unmodified
 * top-level functions (render, navigate, computeAttention, searchAll, ...)
 * from node:test, without a browser. Both files are classic (non-module)
 * scripts meant to run directly in a page via <script> tags in the same
 * order as index.html, so this loads them into one shared vm context with
 * the minimal DOM/BOM surface they touch — no real network, no real
 * browser. Mirrors apps/executive-briefing/test/loadApp.mjs's technique,
 * extended with location/navigator/setTimeout since this app is an
 * interactive SPA (routing, clipboard, toasts) rather than a linear
 * briefing deck.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_JS_PATH = path.join(__dirname, "..", "data.js");
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
    focus() {},
  };
}

export function loadApp(initialHash = "#/home") {
  const dataSource = fs.readFileSync(DATA_JS_PATH, "utf8");
  const appSource = fs.readFileSync(APP_JS_PATH, "utf8");
  const appEl = makeStubElement();
  const docListeners = {};
  const windowListeners = {};
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    location: { hash: initialHash },
    navigator: { clipboard: { writeText: async () => {} } },
    document: {
      getElementById(id) {
        if (id === "app") return appEl;
        if (id === "globalSearch") return makeStubElement();
        return null;
      },
      addEventListener(type, fn) {
        docListeners[type] = docListeners[type] || [];
        docListeners[type].push(fn);
      },
    },
  };
  sandbox.window = sandbox;
  sandbox.addEventListener = (type, fn) => {
    windowListeners[type] = windowListeners[type] || [];
    windowListeners[type].push(fn);
  };
  vm.createContext(sandbox);
  vm.runInContext(dataSource, sandbox, { filename: "data.js" });
  vm.runInContext(appSource, sandbox, { filename: "app.js" });
  sandbox.__appEl = appEl;
  return sandbox;
}
