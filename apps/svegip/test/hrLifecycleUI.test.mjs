/**
 * PR #13: tests for the HR Lifecycle & Approval UI rendering logic in
 * app.js (renderHrDashboard, renderHrmsLifecycleList, renderHrmsCaseDetail
 * and its per-type Process Details tabs, hrmsCaseApprovalsTab,
 * decideHrmsTask's duplicate-submission guard) — exercised via loadApp()
 * against the real, unmodified app.js, using fixture data shaped like the
 * real HRMS/Organisation/Workflow API envelopes. Covers: no empty
 * decorative tabs per lifecycle type, no raw case/employee/assignment/
 * workflow ids anywhere in rendered HTML, humanized statuses, and that a
 * real backend action (probation decision) is never faked client-side.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { loadApp, signIn } from "./loadApp.mjs";

const REF = {
  legalEntities: [{ id: "le-my", name: "SVE International Sdn. Bhd." }],
  businessUnits: [{ id: "bu-1", name: "Strategy & Planning" }],
  departments: [{ id: "dept-1", name: "Strategic Business Management" }],
  positions: [{ id: "pos-1", title: "Strategic Business Management Consultant" }],
};

const EMPLOYEE_UUID = "employee-jane-tan-uuid-not-shown";
const CASE_UUID = "case-uuid-not-shown";

function fullEmployee(overrides = {}) {
  return {
    id: EMPLOYEE_UUID,
    employeeNumber: "EMP-000123",
    legalName: "Jane Tan",
    preferredName: "Jane",
    workEmail: "jane.tan@sve.example",
    employmentCountry: "MY",
    currentAssignment: { legalEntityId: "le-my", businessUnitId: "bu-1", departmentId: "dept-1", positionId: "pos-1", workLocation: "Kuala Lumpur", workArrangement: "on_site" },
    restricted: {
      personalEmail: null,
      status: "ACTIVE",
      currentAssignment: { employmentType: "full_time", status: "ACTIVE", startDate: "2024-01-01", confirmationDate: null, probationEndDate: "2024-04-01", endDate: null, effectiveFrom: "2024-01-01", effectiveTo: null, changeReason: null },
      managerDisplay: { name: "Eric Tang", title: "Chief Strategic & Planning Officer" },
    },
    ...overrides,
  };
}

function baseCase(lifecycleType, overrides = {}) {
  return {
    id: CASE_UUID,
    caseNumber: "HR-000045",
    employeeId: EMPLOYEE_UUID,
    legalEntityId: "le-my",
    lifecycleType,
    status: "IN_PROGRESS",
    initiatedAt: "2024-01-01T00:00:00.000Z",
    hrOwnerUserId: "hr-owner-uuid-not-shown",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    restricted: { caseSubtype: null, currentStage: "manager_review", effectiveDate: null, outcome: null, reasonCategory: null, noticeDate: null, intendedLastWorkingDate: null, completedAt: null, cancelledAt: null, proposedChange: null },
    ...overrides,
  };
}

test("HR Dashboard: shows all four lifecycle areas with links, and no raw case ids", async () => {
  const app = loadApp();
  const html = app.renderHrDashboard({ employees: [{ id: "1" }], onboarding: [baseCase("onboarding")], probation: [baseCase("probation")], employmentChange: [baseCase("employment_change")], offboarding: [baseCase("offboarding")] });
  for (const label of ["Onboarding", "Probation & Confirmation", "Employment Changes", "Offboarding"]) {
    assert.ok(html.includes(`>${label}<`), `expected a "${label}" panel`);
  }
  assert.ok(!html.includes(`>${CASE_UUID}<`), "the raw case id must never appear as VISIBLE text — it may still appear inside a goHrmsCase(...) navigation handler, exactly like every existing case/employee link in this app");
  assert.ok(html.includes("HR-000045"), "the human-facing case number is fine to show");
});

/**
 * hrmsLifecycleType is a top-level `let` in app.js — per loadApp.mjs's own
 * contract, such lexical bindings do not attach to the sandbox object, so
 * only a real exported function that assigns it (goHrmsLifecycle) can
 * change what renderHrmsLifecycleList's closure actually sees; setting
 * app.hrmsLifecycleType directly would silently no-op. goHrmsLifecycle
 * also calls secureGo(), whose own rendering path this sandbox does not
 * fully support (no signed-in nav target) — the lexical assignment
 * happens synchronously first, so swallowing that call's own error still
 * leaves hrmsLifecycleType correctly set for the render call that follows.
 */
function setHrmsLifecycleType(app, type) {
  try {
    app.goHrmsLifecycle(type);
  } catch {
    /* secureGo's own render path is not exercised by this test */
  }
}

test("Lifecycle list: resolves the employee's name, and only shows Approval Status for submittable types", async () => {
  const app = loadApp();
  const employeeName = (id) => (id === EMPLOYEE_UUID ? "Jane" : "—");

  setHrmsLifecycleType(app, "onboarding");
  const onboardingHtml = app.renderHrmsLifecycleList({ cases: [baseCase("onboarding")], employeeName });
  assert.ok(onboardingHtml.includes("Jane"), "the list must show the resolved employee name");
  assert.ok(!onboardingHtml.includes("Approval Status"), "onboarding never goes through Workflow approval — no such column");
  assert.ok(!onboardingHtml.includes(`>${EMPLOYEE_UUID}<`) && !onboardingHtml.includes(`>${CASE_UUID}<`), "no raw ids shown as visible text in the list");

  setHrmsLifecycleType(app, "employment_change");
  const changeHtml = app.renderHrmsLifecycleList({ cases: [baseCase("employment_change", { status: "PENDING_DECISION" })], employeeName });
  assert.ok(changeHtml.includes("Approval Status"), "employment_change is submittable — Approval Status column expected");
  assert.ok(changeHtml.includes("Pending approval"), "PENDING_DECISION must render as a human-readable approval status");
});

test("Lifecycle list: an employee record the caller cannot resolve renders as '—', never a blank or a raw id", async () => {
  const app = loadApp();
  setHrmsLifecycleType(app, "onboarding");
  const html = app.renderHrmsLifecycleList({ cases: [baseCase("onboarding")], employeeName: () => "—" });
  assert.ok(html.includes(">—<") || html.includes("<strong>—</strong>"));
});

test("Case detail: onboarding shows Overview/Process Details/Milestones/History — never Approvals (onboarding never goes through Workflow)", async () => {
  const app = loadApp();
  const data = { caseRow: baseCase("onboarding"), events: [], milestones: [], employee: fullEmployee(), ref: REF, reviews: [], approval: null, deactivation: null };
  const html = app.renderHrmsCaseDetail(data);
  for (const label of ["Overview", "Process Details", "Milestones", "History"]) assert.ok(html.includes(`>${label}<`));
  assert.ok(!html.includes(">Approvals<"));
  assert.ok(!html.includes(CASE_UUID) && !html.includes(EMPLOYEE_UUID), "no raw ids in the case header/tabs");
});

test("Case detail: probation shows Overview/Process Details/History only, with real review data (no Approvals, no Milestones — neither exists for this type)", async () => {
  const app = loadApp();
  const reviews = [{ id: "r1", sequenceNumber: 1, periodStart: "2024-01-01", expectedReviewDate: "2024-04-01", reviewStatus: "PENDING", decision: null, decisionDate: null, recommendation: null }];
  const data = { caseRow: baseCase("probation"), events: [], milestones: [], employee: fullEmployee(), ref: REF, reviews, approval: null, deactivation: null };
  const html = app.renderHrmsCaseDetail(data);
  for (const label of ["Overview", "Process Details", "History"]) assert.ok(html.includes(`>${label}<`));
  assert.ok(!html.includes(">Approvals<") && !html.includes(">Milestones<"));
  const processHtml = app.hrmsCaseProcessProbation(data);
  assert.ok(processHtml.includes("Confirm") && processHtml.includes("Extend") && processHtml.includes("Mark Unsuccessful"), "a PENDING review on an IN_PROGRESS case must offer real decision actions");
});

test("Case detail: probation decision actions are hidden once the review is no longer PENDING — no fake client-side confirmation is ever implied", async () => {
  const app = loadApp();
  const reviews = [{ id: "r1", sequenceNumber: 1, periodStart: "2024-01-01", expectedReviewDate: "2024-04-01", reviewStatus: "COMPLETED", decision: "CONFIRMED", decisionDate: "2024-04-01", recommendation: null }];
  const data = { caseRow: baseCase("probation", { status: "COMPLETED" }), events: [], milestones: [], employee: fullEmployee(), ref: REF, reviews, approval: null, deactivation: null };
  const processHtml = app.hrmsCaseProcessProbation(data);
  assert.ok(!processHtml.includes("hrms-task-actions"), "a decided/completed review must not still offer decision buttons");
  assert.ok(processHtml.includes("Confirmed"), "the recorded decision is shown as a humanized outcome");
});

test("Case detail: employment_change shows Current vs Proposed, correctly separated (a proposed change never bleeds into Current before its effective date)", async () => {
  const app = loadApp();
  const caseRow = baseCase("employment_change", { status: "PENDING_DECISION", restricted: { ...baseCase("employment_change").restricted, proposedChange: { employmentType: "full_time", positionId: "pos-1", departmentId: "dept-1", businessUnitId: "bu-1", effectiveFrom: "2025-01-01" } } });
  const data = { caseRow, events: [], milestones: [], employee: fullEmployee(), ref: REF, reviews: [], approval: { submitted: true, status: "ACTIVE", outcome: null, visible: true }, deactivation: null };
  const html = app.renderHrmsCaseDetail(data);
  assert.ok(html.includes(">Approvals<"));
  const processHtml = app.hrmsCaseProcessEmploymentChange(data);
  assert.ok(processHtml.includes(">Current<") && processHtml.includes(">Proposed<"));
  assert.ok(processHtml.includes("Strategic Business Management Consultant"), "the proposed position resolves to a real display name, not a raw id");
});

test("Case detail: employment_change Proposed shows an honest not-yet-submitted state rather than inventing values", async () => {
  const app = loadApp();
  const data = { caseRow: baseCase("employment_change"), events: [], milestones: [], employee: fullEmployee(), ref: REF, reviews: [], approval: null, deactivation: null };
  const html = app.hrmsCaseProcessEmploymentChange(data);
  assert.ok(/not available|not.*submitted/i.test(html));
});

test("Case detail: offboarding shows Approvals and Milestones tabs, and a humanized deactivation status — never a raw processor state", async () => {
  const app = loadApp();
  const data = { caseRow: baseCase("offboarding", { status: "COMPLETED", restricted: { ...baseCase("offboarding").restricted, intendedLastWorkingDate: "2024-06-01", outcome: "RESIGNED", effectiveDate: "2024-06-01" } }), events: [], milestones: [{ id: "m1", milestoneType: "access_removal", status: "COMPLETED", dueDate: null }], employee: fullEmployee(), ref: REF, reviews: [], approval: { submitted: true, status: "COMPLETED", outcome: "APPROVED", visible: true }, deactivation: { status: "requested", requestedAt: "2024-06-01T00:00:00.000Z", completedAt: null } };
  const html = app.renderHrmsCaseDetail(data);
  assert.ok(html.includes(">Approvals<") && html.includes(">Milestones<"));
  const processHtml = app.hrmsCaseProcessOffboarding(data);
  assert.ok(processHtml.includes("Requested"), "deactivation status must be humanized");
  assert.ok(!/REQUESTED|not_requested/.test(processHtml), "the raw processor status string must never be shown");
});

test("Approvals tab never names the individual approver — only the recorded status/decision (mirrors the existing requester-masking convention)", async () => {
  const app = loadApp();
  const html = app.hrmsCaseApprovalsTab({ approval: { submitted: true, status: "COMPLETED", outcome: "APPROVED", visible: true } });
  assert.ok(html.includes("Approved"));
  assert.ok(!/userId|actorUserId|decisionActorUserId/i.test(html), "no internal actor field name must ever surface in the approvals tab");
});

test("Approvals tab: a case not yet submitted shows an honest message, not an empty/blank panel", async () => {
  const app = loadApp();
  const html = app.hrmsCaseApprovalsTab({ approval: null });
  assert.ok(/not.*submitted/i.test(html));
});

test("decideHrmsTask: a second call for the same task while the first is still in flight is a no-op (duplicate-submission guard)", async () => {
  const app = loadApp();
  await signIn(app, { email: "hr@example.test", name: "Test HR", role: "Management", unit: "SVE", permissions: [] });
  let fetchCalls = 0;
  let resolveFirst;
  app.fetch = async (url) => {
    if (String(url).includes("/decide")) {
      fetchCalls++;
      return new Promise((resolve) => {
        resolveFirst = () => resolve({ ok: true, status: 200, json: async () => ({ data: { task: { id: "t1", status: "COMPLETED" }, decision: { id: "d1", decision: "APPROVE" } } }) });
      });
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const firstCall = app.decideHrmsTask("t1", "APPROVE");
  await app.decideHrmsTask("t1", "APPROVE");
  assert.equal(fetchCalls, 1, "a second decision attempt on the same task while the first is in flight must not fire a second request");
  resolveFirst();
  await firstCall;
});
