/**
 * PR #11 brief item 22: "no sensitive HR data is persisted to
 * localStorage." Since app.js is a single non-modular script, the
 * strongest test available without a full browser is a direct source
 * check: this file must never reference localStorage/sessionStorage at
 * all — HRMS data is always fetched live through svegipApiFetch, never
 * cached in browser storage.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

test("app.js never reads or writes localStorage/sessionStorage", () => {
  // Matches actual API usage (localStorage.getItem(...), window.sessionStorage[...],
  // etc.) — not the bare word, which legitimately appears in this file's
  // own doc comments describing the constraint being tested here.
  const hits = source.match(/\b(local|session)Storage\s*[.[]/g) || [];
  assert.deepEqual(hits, [], "app.js must not persist any data (HR or otherwise) to browser storage");
});
