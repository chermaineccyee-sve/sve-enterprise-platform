import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PERMISSIONS } from "../../src/services/access.ts";
import { ValidationError } from "../../src/domain/errors.ts";
import { setup, grantRole, actor, hireFictionalEmployee } from "./testSetup.ts";

const FULL_HR_PERMS = [
  { key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" as const },
  { key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" as const },
  { key: PERMISSIONS.READ_RESTRICTED, maxClassification: "CONFIDENTIAL" as const },
  { key: PERMISSIONS.READ_DECISION, maxClassification: "CONFIDENTIAL" as const },
  { key: PERMISSIONS.MANAGE_PROBATION, maxClassification: "CONFIDENTIAL" as const },
];

test("probation extension preserves the original period's history rather than overwriting it", async () => {
  const deps = await setup();
  const hrUser = randomUUID();
  await grantRole(deps.rbacRepo, hrUser, FULL_HR_PERMS, { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.my.id, "Fictional Extension Test");

  const created = await deps.probation.createProbationCase(actor(hrUser), {
    employeeId: employee.id,
    legalEntityId: deps.my.id,
    hrOwnerUserId: hrUser,
    periodStart: "2026-02-10",
    expectedReviewDate: "2026-05-10",
  });
  assert.equal(created.review.sequenceNumber, 1);

  const result = await deps.probation.recordDecision(actor(hrUser), created.case.id, {
    decision: "EXTENDED",
    decisionNotes: "Fictional extension rationale",
    decisionDate: "2026-05-05",
    extension: { periodStart: "2026-05-10", expectedReviewDate: "2026-06-10" },
  });

  assert.equal(result.case.status, "IN_PROGRESS", "an extension keeps the case in progress, not completed");
  assert.equal(result.review.decision, "EXTENDED");
  assert.equal(result.review.periodStart, "2026-02-10", "the ORIGINAL review row's own dates are never rewritten");
  assert.equal(result.review.expectedReviewDate, "2026-05-10");
  assert.ok(result.extension, "an extension must create a new review row");
  assert.equal(result.extension!.sequenceNumber, 2);
  assert.equal(result.extension!.periodStart, "2026-05-10");
  assert.equal(result.extension!.expectedReviewDate, "2026-06-10");
  assert.equal(result.extension!.reviewStatus, "PENDING");

  const history = await deps.probation.listReviews(actor(hrUser), created.case.id);
  assert.equal(history.reviews.length, 2, "both the original and extended periods must be reconstructable");
  assert.equal(history.reviews[0]!.sequenceNumber, 1);
  assert.equal(history.reviews[1]!.sequenceNumber, 2);

  // Final decision on the extended period completes the case.
  const final = await deps.probation.recordDecision(actor(hrUser), created.case.id, {
    decision: "CONFIRMED",
    decisionDate: "2026-06-01",
  });
  assert.equal(final.case.status, "COMPLETED");
  assert.equal(final.case.outcome, "CONFIRMED");
  assert.equal(final.case.effectiveDate, "2026-06-01");
  assert.equal(final.review.sequenceNumber, 2, "the decision applies to the CURRENT (extended) period");

  const fullHistory = await deps.probation.listReviews(actor(hrUser), created.case.id);
  assert.equal(fullHistory.reviews[0]!.decision, "EXTENDED", "the original period's own decision remains EXTENDED, never overwritten by the final CONFIRMED decision");
  assert.equal(fullHistory.reviews[1]!.decision, "CONFIRMED");
});

test("a probation decision can only be recorded once for a given review period", async () => {
  const deps = await setup();
  const hrUser = randomUUID();
  await grantRole(deps.rbacRepo, hrUser, FULL_HR_PERMS, { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.my.id, "Fictional Decide-Once Test");
  const created = await deps.probation.createProbationCase(actor(hrUser), { employeeId: employee.id, legalEntityId: deps.my.id, hrOwnerUserId: hrUser, periodStart: "2026-02-10", expectedReviewDate: "2026-05-10" });

  await deps.probation.recordDecision(actor(hrUser), created.case.id, { decision: "CONFIRMED", decisionDate: "2026-05-08" });
  await assert.rejects(
    () => deps.probation.recordDecision(actor(hrUser), created.case.id, { decision: "UNSUCCESSFUL", decisionDate: "2026-05-09" }),
    ValidationError,
    "a second decision attempt on an already-decided review must be rejected",
  );
});

test("an unsuccessful probation outcome completes the case without creating a successor review", async () => {
  const deps = await setup();
  const hrUser = randomUUID();
  await grantRole(deps.rbacRepo, hrUser, FULL_HR_PERMS, { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.my.id, "Fictional Unsuccessful Test");
  const created = await deps.probation.createProbationCase(actor(hrUser), { employeeId: employee.id, legalEntityId: deps.my.id, hrOwnerUserId: hrUser, periodStart: "2026-02-10", expectedReviewDate: "2026-05-10" });

  const result = await deps.probation.recordDecision(actor(hrUser), created.case.id, { decision: "UNSUCCESSFUL", decisionDate: "2026-05-08", decisionNotes: "Fictional unsuccessful-outcome rationale" });
  assert.equal(result.case.status, "COMPLETED");
  assert.equal(result.case.outcome, "UNSUCCESSFUL");
  assert.equal(result.extension, undefined);

  const history = await deps.probation.listReviews(actor(hrUser), created.case.id);
  assert.equal(history.reviews.length, 1);
});

test("no universal probation duration is assumed: caller-supplied periods of any length are stored as-is", async () => {
  const deps = await setup();
  const hrUser = randomUUID();
  await grantRole(deps.rbacRepo, hrUser, FULL_HR_PERMS, { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.my.id, "Fictional Duration Test");

  // A deliberately unusual (non-3-month) period, to prove nothing hard-codes a duration.
  const created = await deps.probation.createProbationCase(actor(hrUser), { employeeId: employee.id, legalEntityId: deps.my.id, hrOwnerUserId: hrUser, periodStart: "2026-01-01", expectedReviewDate: "2026-12-31" });
  assert.equal(created.review.periodStart, "2026-01-01");
  assert.equal(created.review.expectedReviewDate, "2026-12-31");
});
