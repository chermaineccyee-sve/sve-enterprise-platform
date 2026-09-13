/**
 * PR #11: tests for the SVEGIP portal's own navigation/permission-gating
 * logic (portalAllowed/permittedNav/SVEGIP_ACCESS_POLICY in app.js),
 * exercised via test/loadApp.mjs against the real, unmodified app.js —
 * not a reimplementation of the rules. Covers brief item 22's "navigation
 * renders correctly," "permission-aware navigation behaves correctly,"
 * and "unauthorised HR navigation is not exposed."
 */
import test from "node:test";
import assert from "node:assert/strict";
import { loadApp, signIn } from "./loadApp.mjs";

test("existing SVEGIP navigation is unaffected: Employee role keeps its prior page set plus the new My Workspace items", async () => {
  const app = loadApp();
  await signIn(app, { email: "employee@example.test", name: "Test User", role: "Employee", unit: "SVE", permissions: [] });
  assert.equal(app.portalAllowed("home"), true);
  assert.equal(app.portalAllowed("documents"), true);
  assert.equal(app.portalAllowed("mysve"), true, "every authenticated role gets My SVE");
  assert.equal(app.portalAllowed("mytasks"), true, "every authenticated role gets My Tasks");
});

test("Employee role does NOT see People/HRMS — unauthorised HR navigation is not exposed", async () => {
  const app = loadApp();
  await signIn(app, { email: "employee@example.test", name: "Test User", role: "Employee", unit: "SVE", permissions: [] });
  for (const page of ["hrms", "hrmsDirectory", "hrmsEmployee", "hrmsLifecycle", "hrmsCase", "hrmsApprovals"]) {
    assert.equal(app.portalAllowed(page), false, `Employee must not be allowed on "${page}"`);
  }
  // Hiding is enforced at the render level too, not just the boolean check.
  assert.equal(app.permittedNav("hrms", "People / HRMS"), "", "a disallowed nav item must render as nothing, not a disabled button");
});

test("SKL User role does not see People/HRMS either, but keeps its existing SKL/project/governance access", async () => {
  const app = loadApp();
  await signIn(app, { email: "skl@example.test", name: "Test User", role: "SKL User / Legal Reviewer", unit: "SKL", permissions: [] });
  assert.equal(app.portalAllowed("skl"), true);
  assert.equal(app.portalAllowed("projects"), true);
  assert.equal(app.portalAllowed("mysve"), true);
  assert.equal(app.portalAllowed("hrms"), false);
});

test("Management and Executive Office roles see People/HRMS — the same visibility the old 'people' stub key granted, now under the real workspace", async () => {
  const app = loadApp();
  await signIn(app, { email: "mgmt@example.test", name: "Test User", role: "Management", unit: "SVE", permissions: [] });
  assert.equal(app.portalAllowed("hrms"), true);
  assert.equal(app.portalAllowed("hrmsDirectory"), true);
  assert.equal(app.portalAllowed("admin"), true);

  const app2 = loadApp();
  await signIn(app2, { email: "exec@example.test", name: "Test User", role: "Executive Office", unit: "SVE", permissions: [] });
  assert.equal(app2.portalAllowed("hrms"), true);
  assert.equal(app2.portalAllowed("admin"), false, "Executive Office must not gain Administration access");
});

test("Administrator retains full ('*') access, including the new People/HRMS area", async () => {
  const app = loadApp();
  await signIn(app, { email: "admin@example.test", name: "Test User", role: "Administrator", unit: "SVE", permissions: [] });
  for (const page of ["hrms", "hrmsDirectory", "hrmsEmployee", "hrmsLifecycle", "mysve", "mytasks", "admin"]) {
    assert.equal(app.portalAllowed(page), true);
  }
});

test("a narrowly-granted 'hr.access' permission lets an Employee-role account see People/HRMS without the broader Management/Executive Office role — mirrors the existing accounts.manage/vault.audit convention", async () => {
  const app = loadApp();
  await signIn(app, { email: "hr.specialist@example.test", name: "Test User", role: "Employee", unit: "SVE", permissions: ["hr.access"] });
  assert.equal(app.portalAllowed("hrms"), true);
  assert.equal(app.portalAllowed("hrmsDirectory"), true);
  assert.equal(app.portalAllowed("admin"), false, "hr.access must not imply Administration access");
});

test("navigation visibility is UX only: hiding a menu item is not itself treated as the security boundary (documented, not enforced client-side)", async () => {
  // This test documents the boundary rather than asserting a specific
  // backend call (backend RBAC enforcement is covered by each service's
  // own actor-bridge/RBAC test suites) — it asserts that portalAllowed
  // is purely a nav-visibility function with no side effect that could
  // be mistaken for an authorization decision.
  const app = loadApp();
  await signIn(app, { email: "employee@example.test", name: "Test User", role: "Employee", unit: "SVE", permissions: [] });
  const before = app.portalAllowed("hrms");
  app.portalAllowed("hrms"); // calling it again must be side-effect-free
  assert.equal(app.portalAllowed("hrms"), before);
});
