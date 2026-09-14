/**
 * Covers: no broken asset references, and a reduced-motion smoke test.
 * Plain filesystem/text checks — no browser, no framework.
 */
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function readFile(name) {
  return fs.readFileSync(path.join(ROOT, name), "utf8");
}

test("every asset referenced by index.html/app.js/styles.css exists on disk", () => {
  const sources = ["index.html", "app.js", "styles.css"].map(readFile).join("\n");
  const refs = new Set();
  const re = /assets\/[\w.\-]+/g;
  let m;
  while ((m = re.exec(sources))) refs.add(m[0]);
  assert.ok(refs.size > 0, "expected at least one asset reference to check");
  for (const ref of refs) {
    const full = path.join(ROOT, ref);
    assert.ok(fs.existsSync(full), `referenced asset "${ref}" does not exist at ${full}`);
  }
});

/**
 * These check for actual path/code coupling into apps/svegip (a relative
 * path, an href/src, an import/fetch target) — not for the word "SVEGIP"
 * itself, which the briefing legitimately discusses by name in its copy
 * and comments.
 */
const COUPLING_PATTERNS = [/\.\.\/svegip/i, /apps\/svegip/i, /["'(]\/svegip/i];

test("index.html has no path/link coupling into apps/svegip", () => {
  const html = readFile("index.html");
  for (const re of COUPLING_PATTERNS) assert.doesNotMatch(html, re);
});

test("app.js has no import/fetch/path coupling into apps/svegip", () => {
  // Strip comments first: app.js's own header explains in prose that it is
  // isolated from apps/svegip, which would otherwise trip this check.
  const js = readFile("app.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const re of COUPLING_PATTERNS) assert.doesNotMatch(js, re);
});

test("styles.css defines a prefers-reduced-motion rule (reduced-motion support present)", () => {
  const css = readFile("styles.css");
  assert.match(css, /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/i);
});
