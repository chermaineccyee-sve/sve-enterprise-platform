/**
 * Covers: all four screens reachable, previous/next navigation, keyboard
 * navigation — exercised against the real, unmodified app.js via
 * test/loadApp.mjs, not a reimplementation of the navigation rules.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./loadApp.mjs";

test("all four screens (Phase 1 + Screen 04) are registered, in order", () => {
  const app = loadApp();
  const screens = app.getScreens();
  assert.equal(screens.length, 4);
  // screens is created inside a separate vm realm, so its Array is not the
  // same constructor as this file's Array — compare via JSON rather than
  // assert.deepEqual/deepStrictEqual, which treats that as inequality.
  assert.equal(
    JSON.stringify(screens.map((s) => s.title)),
    JSON.stringify([
      "Executive Opening",
      "From Prototype to Platform",
      "Enterprise Platform Architecture",
      "What Has Already Been Built",
    ])
  );
});

test("nextScreen()/prevScreen() move sequentially and clamp at both ends", () => {
  const app = loadApp();
  assert.equal(app.getCurrentIndex(), 0);
  app.prevScreen();
  assert.equal(app.getCurrentIndex(), 0, "must not go below the first screen");

  app.nextScreen();
  assert.equal(app.getCurrentIndex(), 1);
  app.nextScreen();
  assert.equal(app.getCurrentIndex(), 2);
  app.nextScreen();
  assert.equal(app.getCurrentIndex(), 3, "Screen 04 is now reachable via Next");
  app.nextScreen();
  assert.equal(app.getCurrentIndex(), 3, "must not go past the last screen");

  app.prevScreen();
  assert.equal(app.getCurrentIndex(), 2);
});

test("goToScreen() jumps directly to Screen 04 and clamps out-of-range indexes", () => {
  const app = loadApp();
  app.goToScreen(3);
  assert.equal(app.getCurrentIndex(), 3);
  app.goToScreen(99);
  assert.equal(app.getCurrentIndex(), 3);
  app.goToScreen(-5);
  assert.equal(app.getCurrentIndex(), 0);
});

test("keyboard ArrowRight/ArrowLeft drive the same navigation as the buttons, all the way to Screen 04", () => {
  const app = loadApp();
  app.handleKeydown({ key: "ArrowRight" });
  assert.equal(app.getCurrentIndex(), 1);
  app.handleKeydown({ key: "ArrowRight" });
  assert.equal(app.getCurrentIndex(), 2);
  app.handleKeydown({ key: "ArrowRight" });
  assert.equal(app.getCurrentIndex(), 3);
  app.handleKeydown({ key: "ArrowLeft" });
  assert.equal(app.getCurrentIndex(), 2);
  app.handleKeydown({ key: "Tab" });
  assert.equal(app.getCurrentIndex(), 2, "unrelated keys must not move the screen");
});
