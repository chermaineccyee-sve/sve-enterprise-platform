/**
 * Screen 05 — "One Employee Foundation. A Connected Employment Lifecycle."
 * Covers: four stages in the correct order (JOIN -> PROBATION -> MOVEMENT
 * -> EXIT), CONFIRM is not a fifth primary stage, MOVEMENT maps to the
 * underlying Employment Change capability, JOIN/PROBATION do not claim
 * Workflow approval, MOVEMENT shows Workflow & Approval, EXIT shows the
 * controlled Identity-deactivation sequence with its scheduling
 * qualification visible, Leave/Attendance/Payroll/Payslips/Performance/
 * Training/Claims are never claimed implemented, no real employee/person
 * data appears, no runtime coupling to apps/svegip, and stage
 * selection/reset behaviour. Mobile shares the exact same
 * activePeopleStageIndex state machine as desktop (see app.js), so these
 * logic-level tests cover mobile behaviour too — there is no separate
 * mobile code path to diverge.
 */
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadApp } from "./loadApp.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_JS_SOURCE = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

const NOT_YET_BUILT_HR_MODULES = ["leave", "attendance", "payroll", "payslip", "performance", "training", "claims"];
const REAL_PEOPLE_NAMES = ["ching yee", "eric", "sophia"];

test("Screen 05 is registered as screen index 4 with the approved title", () => {
  const app = loadApp();
  const screens = app.getScreens();
  assert.equal(screens[4].title, "People / HRMS");
  assert.equal(screens[4].number, 5);
});

test("exactly four journey stages exist, in the approved order: JOIN -> PROBATION -> MOVEMENT -> EXIT", () => {
  const app = loadApp();
  const stages = app.getPeopleStages();
  assert.equal(stages.length, 4, "CONFIRM must not be a fifth primary stage");
  assert.equal(
    JSON.stringify(stages.map((s) => s.id)),
    JSON.stringify(["join", "probation", "movement", "exit"])
  );
  assert.equal(
    JSON.stringify(stages.map((s) => s.label)),
    JSON.stringify(["JOIN", "PROBATION", "MOVEMENT", "EXIT"])
  );
});

test("CONFIRM appears only as a probation outcome, never as a stage id/label", () => {
  const app = loadApp();
  const stages = app.getPeopleStages();
  for (const stage of stages) {
    assert.notEqual(stage.id.toLowerCase(), "confirm");
    assert.notEqual(stage.label.toUpperCase(), "CONFIRM");
  }
  const probation = stages.find((s) => s.id === "probation");
  const outcomeLabels = probation.preview.outcomes.map((o) => o.label);
  // outcomeLabels is built from objects created inside a separate vm realm,
  // so assert.deepEqual/deepStrictEqual treats it as unequal despite
  // matching content — compare via JSON instead (see navigation.test.mjs).
  assert.equal(JSON.stringify(outcomeLabels), JSON.stringify(["Confirm", "Extend", "Unsuccessful"]));
});

test("MOVEMENT's executive label maps to the underlying Employment Change capability", () => {
  const app = loadApp();
  const movement = app.getPeopleStages().find((s) => s.id === "movement");
  assert.equal(movement.label, "MOVEMENT");
  assert.equal(movement.systemLabel, "Employment Change");
  assert.equal(app.getPeopleStageSystemLabel("movement"), "Employment Change");
});

test("JOIN and PROBATION do not claim Workflow approval; MOVEMENT and EXIT do", () => {
  const app = loadApp();
  const stages = app.getPeopleStages();
  const join = stages.find((s) => s.id === "join");
  const probation = stages.find((s) => s.id === "probation");
  const movement = stages.find((s) => s.id === "movement");
  const exit = stages.find((s) => s.id === "exit");

  assert.match(join.qualification, /not currently connected to the Workflow approval engine/i);
  assert.match(probation.qualification, /not currently connected to the Workflow approval engine/i);

  const movementConnects = movement.connects.map((c) => c.label).join(" ");
  assert.match(movementConnects, /Workflow & Approval/);
  assert.equal(movement.qualification, null, "MOVEMENT is fully Workflow-integrated and needs no such qualification");

  const exitConnects = exit.connects.map((c) => c.label).join(" ");
  assert.match(exitConnects, /Authorised Approval/);
});

test("EXIT shows the controlled Identity-deactivation sequence with its scheduling qualification visible", () => {
  const app = loadApp();
  const exit = app.getPeopleStages().find((s) => s.id === "exit");
  const connectLabels = exit.connects.map((c) => c.label);
  // See the "CONFIRM appears only..." test above for why JSON comparison
  // is used instead of assert.deepEqual across the vm sandbox boundary.
  assert.equal(
    JSON.stringify(connectLabels),
    JSON.stringify([
      "Offboarding",
      "Authorised Approval",
      "Employment Ends",
      "Access Withdrawal Requested",
      "Identity Deactivation Processing",
      "Account & Active Sessions Revoked",
      "History Preserved",
    ])
  );
  // Must NOT visually imply "approved -> instantly disabled": the
  // qualification must be present on the stage itself (main experience),
  // not only reachable through a secondary disclosure (Screen 05 has none).
  assert.match(exit.qualification, /controlled processing step/i);
  assert.match(exit.qualification, /automated scheduling is not yet configured/i);
  assert.equal(exit.caveat, "Scheduling not yet configured");
});

test("all four stages are tagged Working / Implemented", () => {
  const app = loadApp();
  for (const stage of app.getPeopleStages()) {
    assert.equal(stage.status, "working", `"${stage.label}" must be tagged Working / Implemented`);
  }
});

test("no future Human Resources module is claimed implemented anywhere in Screen 05 content", () => {
  const app = loadApp();
  for (const stage of app.getPeopleStages()) {
    const text = [
      stage.whatHappens,
      stage.whyItMatters,
      stage.qualification || "",
      ...stage.connects.map((c) => `${c.label} ${c.detail}`),
    ]
      .join(" ")
      .toLowerCase();
    for (const module of NOT_YET_BUILT_HR_MODULES) {
      assert.ok(!text.includes(module), `Stage "${stage.label}" must not mention "${module}" as implemented`);
    }
  }
});

test("no real employee/person data (Ching Yee, Eric, Sophia) appears in Screen 05 fixtures", () => {
  const app = loadApp();
  const allText = JSON.stringify(app.getPeopleStages()).toLowerCase();
  for (const name of REAL_PEOPLE_NAMES) {
    assert.ok(!allText.includes(name), `Screen 05 fixture data must not include "${name}"`);
  }
});

test("MOVEMENT and EXIT previews expose no employee/assignment/case identifiers or sensitive fields", () => {
  const app = loadApp();
  const forbidden = [/employee\s*number/i, /employee\s*id/i, /case\s*number/i, /assignment\s*id/i, /\bsalary\b/i, /bank\s*account/i, /\btax\b/i];
  const movement = app.getPeopleStages().find((s) => s.id === "movement");
  const exit = app.getPeopleStages().find((s) => s.id === "exit");
  const movementText = JSON.stringify(movement.preview);
  const exitText = JSON.stringify(exit.preview);
  for (const re of forbidden) {
    assert.doesNotMatch(movementText, re, `Movement preview must not expose ${re}`);
    assert.doesNotMatch(exitText, re, `Exit preview must not expose ${re}`);
  }
});

test("selecting a stage opens it, and re-selecting the same one closes it", () => {
  const app = loadApp();
  assert.equal(app.getActivePeopleStageIndex(), -1);
  app.selectPeopleStage(2);
  assert.equal(app.getActivePeopleStageIndex(), 2);
  app.selectPeopleStage(2);
  assert.equal(app.getActivePeopleStageIndex(), -1, "selecting the same stage again must close it");
});

test("selecting a different stage switches directly; only one stage is expanded at a time", () => {
  const app = loadApp();
  app.selectPeopleStage(0);
  assert.equal(app.getActivePeopleStageIndex(), 0);
  app.selectPeopleStage(3);
  assert.equal(app.getActivePeopleStageIndex(), 3);
});

test("every stage has non-empty what-happens / what-connects / why-it-matters / application preview content", () => {
  const app = loadApp();
  for (const stage of app.getPeopleStages()) {
    assert.ok(stage.whatHappens && stage.whatHappens.length > 10, `${stage.id} missing "what happens"`);
    assert.ok(Array.isArray(stage.connects) && stage.connects.length >= 3, `${stage.id} missing "what connects"`);
    assert.ok(stage.whyItMatters && stage.whyItMatters.length > 10, `${stage.id} missing "why it matters"`);
    assert.ok(stage.preview && stage.preview.kind, `${stage.id} missing an application preview`);
  }
});

test("app.js has no runtime coupling to apps/svegip: no /api/v1 calls, no iframe/embed, no svegip import", () => {
  const source = APP_JS_SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(source, /\/api\/v1/i, "app.js must never call the operational API");
  assert.doesNotMatch(source, /<iframe/i, "app.js must never embed an iframe");
  assert.doesNotMatch(source, /\.\.\/svegip/i);
  assert.doesNotMatch(source, /apps\/svegip/i);
});
