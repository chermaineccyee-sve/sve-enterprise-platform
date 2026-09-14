/**
 * Covers: status labels and architecture interaction — plus, importantly,
 * regression coverage for the explicit factual-discipline requirements
 * from the inspection/approval (Payroll/iClaims/Accounting Pro, private-
 * server/AWS deployment, and native mobile/PWA must never read as
 * "Working / Implemented"; Data Vault must carry its integration caveat).
 * If a future edit to app.js's LAYERS data accidentally overstates one of
 * these, these tests fail.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./loadApp.mjs";

test("Payroll, iClaims and Accounting Pro are never presented as implemented", () => {
  const app = loadApp();
  for (const id of ["payroll", "iclaims", "accounting"]) {
    const status = app.getModuleStatus("domain", id);
    assert.notEqual(status, "working", `"${id}" must not be tagged Working / Implemented`);
    assert.equal(status, "architecture");
  }
});

test("SVE Server / AWS deployment is architecture-only, not implemented", () => {
  const app = loadApp();
  assert.equal(app.getModuleStatus("data", "deployment"), "architecture");
});

test("Data Vault carries the 'server architecture implemented / UI integration pending' caveat", () => {
  const app = loadApp();
  const layers = app.getLayers();
  const domain = layers.find((l) => l.id === "domain");
  const dataVault = domain.modules.find((m) => m.id === "datavault");
  assert.equal(dataVault.status, "working");
  assert.match(dataVault.caveat, /UI integration pending/i);
});

test("no module anywhere on Screen 03 is tagged with an unknown status key", () => {
  const app = loadApp();
  const validKeys = new Set(["working", "architecture", "planned", "future"]);
  for (const layer of app.getLayers()) {
    for (const mod of layer.modules) {
      assert.ok(validKeys.has(mod.status), `${layer.id}/${mod.id} has an invalid status "${mod.status}"`);
    }
  }
});

test("selecting and re-selecting the same module toggles the detail panel off", () => {
  const app = loadApp();
  assert.equal(app.getSelectedModule(), null);
  app.selectModule(0, 0);
  // getSelectedModule()'s object is created inside a separate vm realm, so
  // assert.deepEqual/deepStrictEqual treats it as unequal despite matching
  // fields — compare the fields directly instead.
  const selected = app.getSelectedModule();
  assert.equal(selected.layerIndex, 0);
  assert.equal(selected.moduleIndex, 0);
  app.selectModule(0, 0);
  assert.equal(app.getSelectedModule(), null, "clicking the same module again must clear the selection");
});

test("Stage 4 (Integrated Enterprise Platform) is never tagged Working / Implemented", () => {
  const app = loadApp();
  const stage4 = app.getStageData()[3];
  assert.match(stage4.tag, /target direction/i);
  for (const cap of stage4.capabilities) {
    assert.notEqual(cap.status, "working", `"${cap.label}" must not read as already implemented`);
  }
});

test("getAccumulatedCapabilities builds up rather than replaces: Stage 3 includes Stages 1-3", () => {
  const app = loadApp();
  const acc = app.getAccumulatedCapabilities(2); // stage index 2 == Stage 3
  assert.equal(acc.length, 3);
  assert.equal(acc[2].isCurrent, true);
  assert.equal(acc[0].isCurrent, false);
  assert.equal(acc[0].stage.name, "Internal Information Portal");
});
