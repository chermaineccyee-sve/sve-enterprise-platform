/**
 * Screen 04 — "What Has Already Been Built". Covers: all seven capability
 * groups present, six remain plain Working/Implemented, Data Vault always
 * retains its "UI integration pending" caveat, Payroll/iClaims/Accounting
 * Pro never appear as capability tiles, Screen 04 never claims Leave/
 * Attendance/Payroll/Payslips are already built, capability selection,
 * the What-exists/Why-it-matters/Enables-next disclosure, and the View
 * Build Evidence disclosure. Mobile shares the exact same selection state
 * machine as desktop (see app.js's activeCapabilityIndex) rather than a
 * separate implementation, so these logic-level tests cover mobile
 * behaviour too — there is no separate mobile code path to diverge.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./loadApp.mjs";

const FORBIDDEN_FUTURE_MODULES = ["payroll", "iclaims", "accounting pro"];
const NOT_YET_BUILT_HR_AREAS = ["leave", "attendance", "payslip"];

test("Screen 04 is registered as screen index 3 with the approved title", () => {
  const app = loadApp();
  const screens = app.getScreens();
  assert.equal(screens[3].title, "What Has Already Been Built");
  assert.equal(screens[3].number, 4);
});

test("exactly seven capability groups exist, in the approved order", () => {
  const app = loadApp();
  const caps = app.getBuiltCapabilities();
  assert.equal(caps.length, 7);
  assert.equal(
    JSON.stringify(caps.map((c) => c.id)),
    JSON.stringify([
      "controlled-access",
      "organisation-employee-master",
      "hr-lifecycle",
      "workflow-approvals",
      "security-revocation",
      "my-sve-people",
      "data-vault-foundation",
    ])
  );
});

test("Payroll, iClaims and Accounting Pro do not appear as Screen 04 capability tiles", () => {
  const app = loadApp();
  const caps = app.getBuiltCapabilities();
  for (const cap of caps) {
    const name = cap.name.toLowerCase();
    for (const forbidden of FORBIDDEN_FUTURE_MODULES) {
      assert.ok(!name.includes(forbidden), `"${cap.name}" must not itself be a Payroll/iClaims/Accounting Pro tile`);
    }
  }
});

test("six capability groups are plain Working/Implemented; only Data Vault carries a caveat", () => {
  const app = loadApp();
  const caps = app.getBuiltCapabilities();
  const withCaveat = caps.filter((c) => c.caveat);
  assert.equal(withCaveat.length, 1, "exactly one capability should carry a caveat");
  assert.equal(withCaveat[0].id, "data-vault-foundation");
  for (const cap of caps) {
    assert.equal(cap.status, "working", `"${cap.name}" must be tagged Working / Implemented`);
  }
});

test("Data Vault Foundation always retains the 'UI integration pending' qualification", () => {
  const app = loadApp();
  const dataVault = app.getBuiltCapabilities().find((c) => c.id === "data-vault-foundation");
  assert.match(dataVault.caveat, /UI integration pending/i);
  // The exact phrase from Screens 02/03 must also appear in the plain-English explanation.
  assert.match(dataVault.whatExists + dataVault.whyItMatters + dataVault.enablesNext, /server-backed|server-based/i);
});

test("Screen 04 never claims Leave, Attendance or Payslips are already built", () => {
  const app = loadApp();
  const caps = app.getBuiltCapabilities();
  for (const cap of caps) {
    const alreadyBuiltText = `${cap.meaning} ${cap.whatExists} ${cap.whyItMatters}`.toLowerCase();
    for (const area of NOT_YET_BUILT_HR_AREAS) {
      assert.ok(
        !alreadyBuiltText.includes(area),
        `"${cap.name}"'s already-built copy (meaning/whatExists/whyItMatters) must not mention "${area}"`
      );
    }
  }
  // The HR Lifecycle capability is allowed to name Leave/Attendance only under "enables next",
  // and only alongside an explicit not-yet-built qualifier.
  const hrLifecycle = caps.find((c) => c.id === "hr-lifecycle");
  assert.match(hrLifecycle.enablesNext, /leave/i);
  assert.match(hrLifecycle.enablesNext, /not yet built/i);
});

test("selecting a capability opens it, and re-selecting the same one closes it", () => {
  const app = loadApp();
  assert.equal(app.getActiveCapabilityIndex(), -1);
  app.selectCapability(3);
  assert.equal(app.getActiveCapabilityIndex(), 3);
  app.selectCapability(3);
  assert.equal(app.getActiveCapabilityIndex(), -1, "selecting the same capability again must close it");
});

test("selecting a different capability switches the active one directly", () => {
  const app = loadApp();
  app.selectCapability(0);
  assert.equal(app.getActiveCapabilityIndex(), 0);
  app.selectCapability(4);
  assert.equal(app.getActiveCapabilityIndex(), 4, "only one capability should be open at a time");
});

test("every capability has non-empty What exists / Why it matters / Enables next copy", () => {
  const app = loadApp();
  for (const cap of app.getBuiltCapabilities()) {
    assert.ok(cap.whatExists && cap.whatExists.length > 10, `${cap.id} missing "What exists"`);
    assert.ok(cap.whyItMatters && cap.whyItMatters.length > 10, `${cap.id} missing "Why it matters"`);
    assert.ok(cap.enablesNext && cap.enablesNext.length > 10, `${cap.id} missing "Enables next"`);
  }
});

test("Controlled Access and Security & Access Revocation are distinguished (granting vs. removing access)", () => {
  const app = loadApp();
  const caps = app.getBuiltCapabilities();
  const controlledAccess = caps.find((c) => c.id === "controlled-access");
  const revocation = caps.find((c) => c.id === "security-revocation");
  assert.notEqual(controlledAccess.meaning, revocation.meaning);
  assert.match(revocation.whyItMatters, /distinct from Controlled Access/i);
});

test("View Build Evidence is closed by default and only toggles once a capability is selected", () => {
  const app = loadApp();
  assert.equal(app.getBuildEvidenceOpen(), false);
  app.toggleBuildEvidence();
  assert.equal(app.getBuildEvidenceOpen(), false, "toggling with nothing selected must be a no-op");

  app.selectCapability(2);
  app.toggleBuildEvidence();
  assert.equal(app.getBuildEvidenceOpen(), true);
  app.toggleBuildEvidence();
  assert.equal(app.getBuildEvidenceOpen(), false);
});

test("selecting a new capability (or closing the current one) resets View Build Evidence", () => {
  const app = loadApp();
  app.selectCapability(1);
  app.toggleBuildEvidence();
  assert.equal(app.getBuildEvidenceOpen(), true);

  app.selectCapability(5);
  assert.equal(app.getBuildEvidenceOpen(), false, "a new capability selection must close the evidence panel");

  app.selectCapability(5);
  assert.equal(app.getActiveCapabilityIndex(), -1);
  assert.equal(app.getBuildEvidenceOpen(), false);
});

test("every capability's build evidence is plain-language, with no raw pull-request numbers", () => {
  const app = loadApp();
  for (const cap of app.getBuiltCapabilities()) {
    const evidenceText = Object.values(cap.evidence).join(" ");
    assert.doesNotMatch(evidenceText, /PR\s*#\d+/i, `${cap.id}'s build evidence must not surface a raw PR number`);
    assert.ok(cap.evidence.service && cap.evidence.foundation && cap.evidence.tests && cap.evidence.experience && cap.evidence.milestone);
  }
});

test("getCapabilityStatus looks up by stable id, safe against reordering", () => {
  const app = loadApp();
  assert.equal(app.getCapabilityStatus("data-vault-foundation"), "working");
  assert.equal(app.getCapabilityStatus("controlled-access"), "working");
  assert.equal(app.getCapabilityStatus("nonexistent"), null);
});
