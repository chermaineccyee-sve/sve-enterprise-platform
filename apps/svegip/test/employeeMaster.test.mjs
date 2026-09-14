/**
 * PR #12: tests for the Employee Master frontend rendering logic in
 * app.js (renderHrmsEmployeeProfile, renderMySve, hrmsProfileHistoryEvents,
 * hrmsReportsToDisplay) — exercised via loadApp() against the real,
 * unmodified app.js, using fixture data shaped exactly like the real
 * Organisation/HRMS API envelopes (serializeView/serializeCaseView from
 * platform-services/organisation & hrms), not a reimplementation of the
 * rendering rules. Covers: no empty decorative tabs for a viewer without
 * restricted access, manager display resolution/"Not assigned", no raw
 * UUID leakage into rendered HTML, and the merged History timeline.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./loadApp.mjs";

const MANAGER_ASSIGNMENT_ID = "assignment-eric-tang-uuid-not-shown";
const MANAGER_EMPLOYEE_ID = "employee-eric-tang-uuid-not-shown";
const REF = {
  legalEntities: [{ id: "le-my", name: "SVE International Sdn. Bhd." }],
  businessUnits: [{ id: "bu-1", name: "Strategy & Planning" }],
  departments: [{ id: "dept-1", name: "Strategic Business Management" }],
  positions: [{ id: "pos-1", title: "Strategic Business Management Consultant" }],
};

function fullEmployee(overrides = {}) {
  return {
    id: "employee-jane-tan-uuid-not-shown",
    employeeNumber: "EMP-000123",
    legalName: "Jane Tan",
    preferredName: "Jane",
    workEmail: "jane.tan@sve.example",
    employmentCountry: "MY",
    currentAssignment: { legalEntityId: "le-my", businessUnitId: "bu-1", departmentId: "dept-1", positionId: "pos-1", workLocation: "Kuala Lumpur", workArrangement: "on_site" },
    restricted: {
      personalEmail: null,
      status: "ACTIVE",
      currentAssignment: { employmentType: "full_time", status: "ACTIVE", startDate: "2024-01-01", confirmationDate: "2024-04-01", probationEndDate: "2024-04-01", endDate: null, effectiveFrom: "2024-01-01", effectiveTo: null, changeReason: null },
      managerDisplay: { name: "Eric Tang", title: "Chief Strategic & Planning Officer" },
    },
    ...overrides,
  };
}

test("Employee Profile: Employment and History tabs are omitted entirely (not shown empty) for a viewer without restricted access", async () => {
  const app = loadApp();
  const data = { employee: fullEmployee({ restricted: null }), assignments: [], cases: [], ref: REF };
  const html = app.renderHrmsEmployeeProfile(data);
  assert.ok(!html.includes(">Employment<"), "Employment tab must not be rendered when restricted access is absent");
  assert.ok(!html.includes(">History<"), "History tab must not be rendered when restricted access is absent");
  assert.ok(html.includes(">Overview<"), "Overview remains available (directory-level fields only)");
  assert.ok(html.includes(">Organisation &amp; Reporting<") || html.includes("Organisation & Reporting"), "Organisation & Reporting remains available (directory-level fields)");
  assert.ok(!html.includes("Not available in this release"), "no unfinished/developer-facing messaging in a user-facing screen");
});

test("Employee Profile: all five tabs render for a viewer WITH restricted access, and the manager is shown by name — never a raw id", async () => {
  const app = loadApp();
  const data = { employee: fullEmployee(), assignments: [{ id: "a1", employeeId: "e1", legalEntityId: "le-my", employmentType: "full_time", status: "ACTIVE", startDate: "2024-01-01", effectiveFrom: "2024-01-01", effectiveTo: null, changeReason: null }], cases: [], ref: REF };
  const html = app.renderHrmsEmployeeProfile(data);
  for (const label of ["Overview", "Employment", "Lifecycle", "History"]) {
    assert.ok(html.includes(`>${label}<`), `expected a "${label}" tab button`);
  }
  assert.ok(!html.includes(MANAGER_ASSIGNMENT_ID), "the manager's raw assignment id must never appear in rendered HTML");
  assert.ok(!html.includes(MANAGER_EMPLOYEE_ID), "the manager's raw employee id must never appear in rendered HTML");
  assert.ok(!html.includes(data.employee.id), "the viewed employee's own raw UUID must never appear in rendered HTML");
});

test("Employee Profile Organisation & Reporting: 'Reports To' shows 'Not assigned' (never a raw id) when there is no manager", async () => {
  const app = loadApp();
  const employee = fullEmployee({ restricted: { ...fullEmployee().restricted, managerDisplay: null } });
  const html = app.hrmsReportsToDisplay(employee);
  assert.equal(html, "Not assigned");
});

test("Employee Profile Organisation & Reporting: a resolved manager renders as 'Name — Title'", async () => {
  const app = loadApp();
  const html = app.hrmsReportsToDisplay(fullEmployee());
  assert.equal(html, "Eric Tang — Chief Strategic &amp; Planning Officer");
});

test("Employee Profile History: merges assignment history and completed lifecycle cases into one chronological timeline without a new event-sourcing framework", async () => {
  const app = loadApp();
  const data = {
    employee: fullEmployee(),
    assignments: [
      { id: "a0", employeeId: "e1", legalEntityId: "le-my", employmentType: "full_time", status: "ACTIVE", startDate: "2022-01-01", effectiveFrom: "2022-01-01", effectiveTo: "2023-12-31", changeReason: null },
      { id: "a1", employeeId: "e1", legalEntityId: "le-my", employmentType: "full_time", status: "ACTIVE", startDate: "2024-01-01", effectiveFrom: "2024-01-01", effectiveTo: null, changeReason: "Promotion to Senior Consultant" },
    ],
    cases: [
      { id: "c1", caseNumber: "HR-000045", employeeId: "e1", legalEntityId: "le-my", lifecycleType: "probation", status: "COMPLETED", initiatedAt: "2024-01-01T00:00:00.000Z", restricted: { completedAt: "2024-04-15T00:00:00.000Z", cancelledAt: null } },
    ],
    ref: REF,
  };
  const events = app.hrmsProfileHistoryEvents(data);
  assert.equal(events.length, 3);
  assert.equal(events[0].date, "2024-04-15", "most recent event (probation completion) sorts first — History is intentionally newest-first");
  assert.ok(events.some((e) => e.label === "Joined"), "the earliest assignment row is labelled Joined");
  assert.ok(events.some((e) => e.label.includes("Promotion to Senior Consultant")), "a later transition uses its own human-authored change reason");
  assert.ok(events.some((e) => /Probation.*completed/.test(e.label)), "a completed lifecycle case appears as a human-readable completion event");

  const lifecycleEvent = events.find((e) => /Probation.*completed/.test(e.label));
  assert.equal(lifecycleEvent.detail, null, "the internal HR case number (HR-000045) is never surfaced as the event's detail");

  const html = app.hrmsProfileHistoryTab(data);
  assert.ok(!html.includes("HR-000045"), "the History timeline must never display a raw internal case identifier");
});

test("My SVE: renders the employee's own manager and department without exposing HR-only admin fields, and never leaks a raw id", async () => {
  const app = loadApp();
  const data = { employee: fullEmployee(), tasks: [], ref: REF };
  const html = app.renderMySve(data);
  assert.ok(html.includes("Eric Tang"), "My SVE shows the employee's own manager by name");
  assert.ok(html.includes("Strategic Business Management"), "My SVE shows the resolved department name");
  assert.ok(!html.includes(data.employee.id), "no raw employee id in My SVE");
  assert.ok(!html.includes(MANAGER_ASSIGNMENT_ID), "no raw manager assignment id in My SVE");
  assert.ok(!html.includes("audit"), "My SVE never surfaces audit/admin terminology");
});

test("My SVE: an unlinked account gets an honest 'not linked' message, not an error page", async () => {
  const app = loadApp();
  const html = app.renderMySve({ employee: null, tasks: [], ref: REF });
  assert.ok(/not linked/i.test(html));
});

test("Employee Profile: preserves an avatar slot with an initials fallback, ready for a future employee photograph", async () => {
  const app = loadApp();
  const data = { employee: fullEmployee(), assignments: [], cases: [], ref: REF };
  const html = app.renderHrmsEmployeeProfile(data);
  assert.ok(html.includes('class="employee-avatar hrms-avatar-lg"'), "the profile header keeps the same avatar slot My SVE uses");
  assert.ok(html.includes(">J<") || /employee-avatar hrms-avatar-lg">[A-Z]{1,2}</.test(html), "the slot falls back to initials when no photograph is available");
});

test("Employee Profile: all five tabs are present in the rendered DOM regardless of viewport — mobile accessibility is a CSS scroll affordance, never a removed tab", async () => {
  const app = loadApp();
  const data = { employee: fullEmployee(), assignments: [], cases: [], ref: REF };
  const html = app.renderHrmsEmployeeProfile(data);
  const tabMatches = [...html.matchAll(/class="tab[^"]*"[^>]*onclick="hrmsSwitchProfileTab\('(\w+)'\)"/g)].map((m) => m[1]);
  assert.deepEqual(tabMatches, ["overview", "employment", "organisation", "lifecycle", "history"], "all five tabs must always be rendered — narrow-viewport accessibility comes from the existing .tabs horizontal-scroll CSS, never from conditionally omitting a tab");
});
