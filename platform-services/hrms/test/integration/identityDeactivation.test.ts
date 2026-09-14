/**
 * HRMS -> Identity deactivation integration (PR #10) — real Postgres
 * tests for the durable request lifecycle: offboarding completion creates
 * the request row atomically; identityDeactivationProcessor consumes it
 * to actually disable the account, revoke sessions, and audit — all in
 * one shared transaction; idempotency and concurrency (Race A/D);
 * failure/rollback. See docs/architecture/identity-offboarding-revocation.md.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { DatabaseProvider } from "../../../../packages/shared/src/DatabaseProvider.ts";
import { withTestDb, getTestDatabaseUrl } from "./testDb.ts";
import { createPgRbacRepository } from "../../../identity/src/repositories/postgres/pgRbacRepository.ts";
import { createHrmsContainer, type HrmsContainer } from "../../src/composition/container.ts";
import { PERMISSIONS } from "../../src/services/access.ts";
import { PERMISSIONS as ORG_PERMISSIONS } from "../../../organisation/src/services/employeeService.ts";
import { PERMISSIONS as IDENTITY_ACCOUNT_PERMISSIONS } from "../../../identity/src/services/accountSecurityService.ts";

const skip: boolean | string = getTestDatabaseUrl() ? false : "DATABASE_URL not set — run against a real Postgres to exercise this suite (see CI).";

function actor(userId: string, email?: string) {
  return { userId, email: email ?? `${userId}@example.test` };
}

async function grantRole(
  db: DatabaseProvider,
  userId: string,
  permissions: { key: string; maxClassification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED" | "PRIVILEGED" }[],
  entityGrant: { scopeType: "group" } | { scopeType: "legal_entity"; legalEntityId: string },
  grantedBy: string,
) {
  const rbacRepo = createPgRbacRepository(db);
  const role = await rbacRepo.createRole({ key: `role-${randomUUID()}`, name: "Test role" });
  for (const p of permissions) {
    const existing = await rbacRepo.findPermissionByKey(p.key);
    const permission = existing ?? (await rbacRepo.createPermission({ key: p.key, maxClassification: p.maxClassification }));
    await rbacRepo.grantPermissionToRole(role.id, permission.id);
  }
  await rbacRepo.assignRole({ userId, roleId: role.id, grantedBy });
  await rbacRepo.grantEntityAccess({ userId, ...entityGrant, grantedBy } as Parameters<typeof rbacRepo.grantEntityAccess>[0]);
}

async function provisionHr(db: DatabaseProvider, container: HrmsContainer, email: string): Promise<{ userId: string; email: string }> {
  const user = await container.users.createUser({ email, accountType: "employee" });
  await grantRole(
    db,
    user.id,
    [
      { key: ORG_PERMISSIONS.CREATE, maxClassification: "RESTRICTED" },
      { key: ORG_PERMISSIONS.MANAGE_ASSIGNMENT, maxClassification: "CONFIDENTIAL" },
      { key: PERMISSIONS.CREATE, maxClassification: "RESTRICTED" },
      { key: PERMISSIONS.MANAGE_OFFBOARDING, maxClassification: "CONFIDENTIAL" },
    ],
    { scopeType: "group" },
    user.id,
  );
  return actor(user.id, email);
}

/** A narrowly-scoped trusted integration principal — holds ONLY identity.security.manage_account, nothing else. See docs "System principal". */
async function provisionSystemPrincipal(db: DatabaseProvider, container: HrmsContainer, email: string, grantedBy: string): Promise<{ userId: string; email: string }> {
  const user = await container.users.createUser({ email, accountType: "service" });
  await grantRole(db, user.id, [{ key: IDENTITY_ACCOUNT_PERMISSIONS.MANAGE_ACCOUNT, maxClassification: "INTERNAL" }], { scopeType: "group" }, grantedBy);
  return actor(user.id, email);
}

async function hireFictional(container: HrmsContainer, admin: { userId: string; email: string }, legalEntityId: string, legalName: string) {
  return container.orgContainer.employees.createEmployee(admin, {
    legalName,
    employmentCountry: "MY",
    initialAssignment: { legalEntityId, employmentType: "full_time", startDate: "2026-01-01" },
  });
}

const OFFBOARDING_INPUT = { endDate: "2026-04-01", status: "RESIGNED" as const, changeReason: "fictional resignation" };

test("completeOffboarding creates a durable REQUESTED deactivation request, atomically, referencing the case/employee/target/requester correctly", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createHrmsContainer(db);
    const hr = await provisionHr(db, container, "iddeactivation.create.hr@example.test");
    const entities = await container.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const employee = await hireFictional(container, hr, my.id, "Fictional Deactivation Create Employee");

    const identityUser = await container.users.createUser({ email: "iddeactivation.create.target@example.test", accountType: "employee" });
    await container.users.linkEmployee({ userId: identityUser.id, employeeId: employee.id, linkedBy: hr.userId });

    const hrCase = await container.offboarding.createOffboardingCase(hr, { employeeId: employee.id, legalEntityId: my.id, hrOwnerUserId: hr.userId, separationType: "resignation" });
    await container.offboarding.completeOffboarding(hr, hrCase.id, OFFBOARDING_INPUT);

    const rows = await db.query<{ case_id: string; employee_id: string; target_user_id: string; requested_by: string; status: string; reason_category: string }>(
      `SELECT case_id, employee_id, target_user_id, requested_by, status, reason_category FROM hr_identity_deactivation_requests WHERE case_id = $1`,
      [hrCase.id],
    );
    assert.equal(rows.rows.length, 1, "exactly one durable request row must exist");
    assert.equal(rows.rows[0]!.employee_id, employee.id);
    assert.equal(rows.rows[0]!.target_user_id, identityUser.id);
    assert.equal(rows.rows[0]!.requested_by, hr.userId);
    assert.equal(rows.rows[0]!.status, "REQUESTED");
    assert.equal(rows.rows[0]!.reason_category, "hrms_offboarding");
  });
});

test("completeOffboarding creates NO deactivation request when the employee has no linked Identity user (nothing to revoke)", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createHrmsContainer(db);
    const hr = await provisionHr(db, container, "iddeactivation.nolink.hr@example.test");
    const entities = await container.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const employee = await hireFictional(container, hr, my.id, "Fictional No-Link Employee");

    const hrCase = await container.offboarding.createOffboardingCase(hr, { employeeId: employee.id, legalEntityId: my.id, hrOwnerUserId: hr.userId, separationType: "resignation" });
    await container.offboarding.completeOffboarding(hr, hrCase.id, OFFBOARDING_INPUT);

    const rows = await db.query<{ count: string }>(`SELECT count(*)::text FROM hr_identity_deactivation_requests WHERE case_id = $1`, [hrCase.id]);
    assert.equal(rows.rows[0]!.count, "0", "no request may be created when there is no Identity user to deactivate");
  });
});

test("identityDeactivation.processOne disables the target account, revokes sessions, and marks the request COMPLETED — atomically, and idempotently on retry", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createHrmsContainer(db);
    const hr = await provisionHr(db, container, "iddeactivation.process.hr@example.test");
    const system = await provisionSystemPrincipal(db, container, "iddeactivation.process.system@example.test", hr.userId);
    const entities = await container.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const employee = await hireFictional(container, hr, my.id, "Fictional Process Employee");

    const identityUser = await container.users.createUser({ email: "iddeactivation.process.target@example.test", accountType: "employee" });
    await container.users.linkEmployee({ userId: identityUser.id, employeeId: employee.id, linkedBy: hr.userId });
    await container.sessions.createSession({ userId: identityUser.id, mfaVerified: true });
    await container.sessions.createSession({ userId: identityUser.id, mfaVerified: true });

    const hrCase = await container.offboarding.createOffboardingCase(hr, { employeeId: employee.id, legalEntityId: my.id, hrOwnerUserId: hr.userId, separationType: "resignation" });
    await container.offboarding.completeOffboarding(hr, hrCase.id, OFFBOARDING_INPUT);
    const requestRow = (await db.query<{ id: string }>(`SELECT id FROM hr_identity_deactivation_requests WHERE case_id = $1`, [hrCase.id])).rows[0]!;

    const result = await container.identityDeactivation.processOne(system, requestRow.id);
    assert.equal(result.outcome, "completed");

    const target = await container.users.findById(identityUser.id);
    assert.equal(target!.status, "disabled");
    assert.equal((await container.sessions.listActiveSessions(identityUser.id)).length, 0);

    const auditRows = await db.query<{ count: string }>(`SELECT count(*)::text FROM security_audit_events WHERE resource_id = $1 AND action = 'account.disabled'`, [identityUser.id]);
    assert.equal(auditRows.rows[0]!.count, "1");

    // Idempotency: process(request) x2 more times -> one effective outcome throughout.
    const second = await container.identityDeactivation.processOne(system, requestRow.id);
    const third = await container.identityDeactivation.processOne(system, requestRow.id);
    assert.equal(second.outcome, "already_completed");
    assert.equal(third.outcome, "already_completed");
    const auditRowsAfterRetries = await db.query<{ count: string }>(`SELECT count(*)::text FROM security_audit_events WHERE resource_id = $1 AND action = 'account.disabled'`, [identityUser.id]);
    assert.equal(auditRowsAfterRetries.rows[0]!.count, "1", "repeated processing must never duplicate the audit entry or the completion");

    const requestAfter = await db.query<{ status: string; attempt_count: number }>(`SELECT status, attempt_count FROM hr_identity_deactivation_requests WHERE id = $1`, [requestRow.id]);
    assert.equal(requestAfter.rows[0]!.status, "COMPLETED");
  });
});

test("PR #13: offboarding.getDeactivationStatus projects not_requested -> requested -> completed, and denies a caller without restricted access", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createHrmsContainer(db);
    const hr = await provisionHr(db, container, "iddeactivation.status.hr@example.test");
    // getDeactivationStatus is gated behind the SAME restricted-tier check
    // as the case itself — provisionHr's baseline grant has no read
    // permission at all, so grant it explicitly for this test.
    await grantRole(db, hr.userId, [{ key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }, { key: PERMISSIONS.READ_RESTRICTED, maxClassification: "CONFIDENTIAL" }], { scopeType: "group" }, hr.userId);
    const system = await provisionSystemPrincipal(db, container, "iddeactivation.status.system@example.test", hr.userId);
    const entities = await container.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const employee = await hireFictional(container, hr, my.id, "Fictional Deactivation Status Employee");
    const identityUser = await container.users.createUser({ email: "iddeactivation.status.target@example.test", accountType: "employee" });
    await container.users.linkEmployee({ userId: identityUser.id, employeeId: employee.id, linkedBy: hr.userId });

    const hrCase = await container.offboarding.createOffboardingCase(hr, { employeeId: employee.id, legalEntityId: my.id, hrOwnerUserId: hr.userId, separationType: "resignation" });
    const beforeCompletion = await container.offboarding.getDeactivationStatus(hr, hrCase.id);
    assert.deepEqual(beforeCompletion, { status: "not_requested", requestedAt: null, completedAt: null });

    await container.offboarding.completeOffboarding(hr, hrCase.id, OFFBOARDING_INPUT);
    const afterCompletion = await container.offboarding.getDeactivationStatus(hr, hrCase.id);
    assert.equal(afterCompletion.status, "requested");
    assert.equal(afterCompletion.completedAt, null);

    const requestRow = (await db.query<{ id: string }>(`SELECT id FROM hr_identity_deactivation_requests WHERE case_id = $1`, [hrCase.id])).rows[0]!;
    await container.identityDeactivation.processOne(system, requestRow.id);
    const afterProcessing = await container.offboarding.getDeactivationStatus(hr, hrCase.id);
    assert.equal(afterProcessing.status, "completed");
    assert.ok(afterProcessing.completedAt);

    // A caller who can see this case's base tier but lacks restricted
    // access gets status: null, not the real value and not an error —
    // mirroring how every other restricted-tier field on this case behaves.
    const baseOnlyUser = await container.users.createUser({ email: "iddeactivation.status.baseonly@example.test", accountType: "employee" });
    await grantRole(db, baseOnlyUser.id, [{ key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }], { scopeType: "group" }, hr.userId);
    const baseOnlyStatus = await container.offboarding.getDeactivationStatus(actor(baseOnlyUser.id, baseOnlyUser.email), hrCase.id);
    assert.equal(baseOnlyStatus.status, null, "a caller without restricted access to this case must not see its real deactivation status");
  });
});

test("identityDeactivation.processAllPending processes every REQUESTED row exactly once", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createHrmsContainer(db);
    const hr = await provisionHr(db, container, "iddeactivation.all.hr@example.test");
    const system = await provisionSystemPrincipal(db, container, "iddeactivation.all.system@example.test", hr.userId);
    const entities = await container.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;

    const targetIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const employee = await hireFictional(container, hr, my.id, `Fictional Batch Employee ${i}`);
      const identityUser = await container.users.createUser({ email: `iddeactivation.all.target.${i}@example.test`, accountType: "employee" });
      await container.users.linkEmployee({ userId: identityUser.id, employeeId: employee.id, linkedBy: hr.userId });
      const hrCase = await container.offboarding.createOffboardingCase(hr, { employeeId: employee.id, legalEntityId: my.id, hrOwnerUserId: hr.userId, separationType: "resignation" });
      await container.offboarding.completeOffboarding(hr, hrCase.id, OFFBOARDING_INPUT);
      targetIds.push(identityUser.id);
    }

    const results = await container.identityDeactivation.processAllPending(system);
    assert.equal(results.length, 3);
    assert.ok(results.every((r) => r.outcome === "completed"));

    for (const targetId of targetIds) {
      const target = await container.users.findById(targetId);
      assert.equal(target!.status, "disabled");
    }

    // A second sweep finds nothing left pending.
    const secondSweep = await container.identityDeactivation.processAllPending(system);
    assert.equal(secondSweep.length, 0);
  });
});

test("Race A: two workers processing the SAME deactivation request concurrently produce exactly one committed completion", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createHrmsContainer(db);
    const hr = await provisionHr(db, container, "iddeactivation.racea.hr@example.test");
    const system = await provisionSystemPrincipal(db, container, "iddeactivation.racea.system@example.test", hr.userId);
    const entities = await container.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const employee = await hireFictional(container, hr, my.id, "Fictional Race A Employee");

    const identityUser = await container.users.createUser({ email: "iddeactivation.racea.target@example.test", accountType: "employee" });
    await container.users.linkEmployee({ userId: identityUser.id, employeeId: employee.id, linkedBy: hr.userId });
    await container.sessions.createSession({ userId: identityUser.id, mfaVerified: true });

    const hrCase = await container.offboarding.createOffboardingCase(hr, { employeeId: employee.id, legalEntityId: my.id, hrOwnerUserId: hr.userId, separationType: "resignation" });
    await container.offboarding.completeOffboarding(hr, hrCase.id, OFFBOARDING_INPUT);
    const requestRow = (await db.query<{ id: string }>(`SELECT id FROM hr_identity_deactivation_requests WHERE case_id = $1`, [hrCase.id])).rows[0]!;

    const [a, b] = await Promise.all([container.identityDeactivation.processOne(system, requestRow.id), container.identityDeactivation.processOne(system, requestRow.id)]);
    const outcomes = [a.outcome, b.outcome].sort();
    // Whichever wins the row lock completes it; the other either sees
    // COMPLETED already (blocked until the winner committed) or, in the
    // narrow window before the winner's lock is even acquired, also
    // "completed" is impossible under FOR UPDATE serialization — exactly
    // one "completed", the other "already_completed".
    assert.deepEqual(outcomes, ["already_completed", "completed"]);

    const auditRows = await db.query<{ count: string }>(`SELECT count(*)::text FROM security_audit_events WHERE resource_id = $1 AND action = 'account.disabled'`, [identityUser.id]);
    assert.equal(auditRows.rows[0]!.count, "1", "exactly one committed completion, never two");
    assert.equal((await container.sessions.listActiveSessions(identityUser.id)).length, 0);
  });
});

test("Failure/rollback: a forced first processing failure leaves the account active and the request durably REQUESTED (never a terminal FAILED status)", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createHrmsContainer(db);
    const hr = await provisionHr(db, container, "iddeactivation.fail.hr@example.test");
    const system = await provisionSystemPrincipal(db, container, "iddeactivation.fail.system@example.test", hr.userId);
    const entities = await container.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const employee = await hireFictional(container, hr, my.id, "Fictional Failure Employee");

    const identityUser = await container.users.createUser({ email: "iddeactivation.fail.target@example.test", accountType: "employee" });
    await container.users.linkEmployee({ userId: identityUser.id, employeeId: employee.id, linkedBy: hr.userId });

    const hrCase = await container.offboarding.createOffboardingCase(hr, { employeeId: employee.id, legalEntityId: my.id, hrOwnerUserId: hr.userId, separationType: "resignation" });
    await container.offboarding.completeOffboarding(hr, hrCase.id, OFFBOARDING_INPUT);
    const requestRow = (await db.query<{ id: string }>(`SELECT id FROM hr_identity_deactivation_requests WHERE case_id = $1`, [hrCase.id])).rows[0]!;

    // Force the defensive re-verification to trip: the case somehow no
    // longer shows COMPLETED (this foundation has no real path that does
    // this — this proves the processor's own safety net, not a realistic
    // production scenario).
    await db.query(`UPDATE hr_lifecycle_cases SET status = 'IN_PROGRESS', completed_at = NULL WHERE id = $1`, [hrCase.id]);

    const result = await container.identityDeactivation.processOne(system, requestRow.id);
    assert.equal(result.outcome, "failed");

    const target = await container.users.findById(identityUser.id);
    assert.equal(target!.status, "active", "the account must never be disabled when the safety re-check failed");

    // The core fix under test: status stays "REQUESTED" (there is no
    // terminal "FAILED" status any more) — only metadata records the
    // failed attempt. This is what keeps the row inside
    // listByStatus("REQUESTED"), and therefore reachable by the very next
    // processAllPending() sweep, with no separate retry path required.
    const requestAfterFailure = await db.query<{ status: string; failure_reason: string | null; attempt_count: number; last_attempted_at: string | null }>(
      `SELECT status, failure_reason, attempt_count, last_attempted_at FROM hr_identity_deactivation_requests WHERE id = $1`,
      [requestRow.id],
    );
    assert.equal(requestAfterFailure.rows[0]!.status, "REQUESTED", "a failed attempt must never move the request out of REQUESTED");
    assert.ok(requestAfterFailure.rows[0]!.failure_reason);
    assert.equal(requestAfterFailure.rows[0]!.attempt_count, 1);
    assert.ok(requestAfterFailure.rows[0]!.last_attempted_at);
  });
});

test("Failure/rollback: after the fault is removed, processAllPending's normal batch sweep (not a by-id retry) picks the previously-failed request back up and disables the account exactly once", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createHrmsContainer(db);
    const hr = await provisionHr(db, container, "iddeactivation.retry.hr@example.test");
    const system = await provisionSystemPrincipal(db, container, "iddeactivation.retry.system@example.test", hr.userId);
    const entities = await container.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const employee = await hireFictional(container, hr, my.id, "Fictional Retry Employee");

    const identityUser = await container.users.createUser({ email: "iddeactivation.retry.target@example.test", accountType: "employee" });
    await container.users.linkEmployee({ userId: identityUser.id, employeeId: employee.id, linkedBy: hr.userId });
    await container.sessions.createSession({ userId: identityUser.id, mfaVerified: true });

    const hrCase = await container.offboarding.createOffboardingCase(hr, { employeeId: employee.id, legalEntityId: my.id, hrOwnerUserId: hr.userId, separationType: "resignation" });
    await container.offboarding.completeOffboarding(hr, hrCase.id, OFFBOARDING_INPUT);
    const requestRow = (await db.query<{ id: string }>(`SELECT id FROM hr_identity_deactivation_requests WHERE case_id = $1`, [hrCase.id])).rows[0]!;

    // First pass fails (fault injected the same way as the previous test).
    await db.query(`UPDATE hr_lifecycle_cases SET status = 'IN_PROGRESS', completed_at = NULL WHERE id = $1`, [hrCase.id]);
    const firstPass = await container.identityDeactivation.processAllPending(system);
    assert.equal(firstPass.length, 1);
    assert.equal(firstPass[0]!.outcome, "failed");
    assert.equal((await container.users.findById(identityUser.id))!.status, "active");

    // Remove the fault, but never call processOne(requestId) directly —
    // going through the ordinary batch sweep is the actual bug fix under
    // test: before this fix, a request that had failed once was moved to
    // a terminal "FAILED" status that listByStatus("REQUESTED") never
    // selected again, so this second sweep would have found nothing.
    await db.query(`UPDATE hr_lifecycle_cases SET status = 'COMPLETED', completed_at = NOW() WHERE id = $1`, [hrCase.id]);
    const secondPass = await container.identityDeactivation.processAllPending(system);
    assert.equal(secondPass.length, 1, "the previously-failed request must still be visible to the normal batch sweep");
    assert.equal(secondPass[0]!.requestId, requestRow.id);
    assert.equal(secondPass[0]!.outcome, "completed");

    const target = await container.users.findById(identityUser.id);
    assert.equal(target!.status, "disabled");
    assert.equal((await container.sessions.listActiveSessions(identityUser.id)).length, 0);

    // Exactly one effective disable/audit occurred across the whole
    // failed-then-retried sequence, never two.
    const auditRows = await db.query<{ count: string }>(`SELECT count(*)::text FROM security_audit_events WHERE resource_id = $1 AND action = 'account.disabled'`, [identityUser.id]);
    assert.equal(auditRows.rows[0]!.count, "1");

    const requestAfter = await db.query<{ status: string; attempt_count: number }>(`SELECT status, attempt_count FROM hr_identity_deactivation_requests WHERE id = $1`, [requestRow.id]);
    assert.equal(requestAfter.rows[0]!.status, "COMPLETED");
    assert.equal(requestAfter.rows[0]!.attempt_count, 2, "one failed attempt + one successful completion");

    // A completed request is never processed again by a later sweep.
    const thirdPass = await container.identityDeactivation.processAllPending(system);
    assert.equal(thirdPass.length, 0);
  });
});

test("Concurrent retry workers: two workers racing to reprocess an already-once-failed, still-REQUESTED request produce exactly one committed completion", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createHrmsContainer(db);
    const hr = await provisionHr(db, container, "iddeactivation.retryrace.hr@example.test");
    const system = await provisionSystemPrincipal(db, container, "iddeactivation.retryrace.system@example.test", hr.userId);
    const entities = await container.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const employee = await hireFictional(container, hr, my.id, "Fictional Retry Race Employee");

    const identityUser = await container.users.createUser({ email: "iddeactivation.retryrace.target@example.test", accountType: "employee" });
    await container.users.linkEmployee({ userId: identityUser.id, employeeId: employee.id, linkedBy: hr.userId });
    await container.sessions.createSession({ userId: identityUser.id, mfaVerified: true });

    const hrCase = await container.offboarding.createOffboardingCase(hr, { employeeId: employee.id, legalEntityId: my.id, hrOwnerUserId: hr.userId, separationType: "resignation" });
    await container.offboarding.completeOffboarding(hr, hrCase.id, OFFBOARDING_INPUT);
    const requestRow = (await db.query<{ id: string }>(`SELECT id FROM hr_identity_deactivation_requests WHERE case_id = $1`, [hrCase.id])).rows[0]!;

    // Force one failed attempt first, so the retry race below starts from
    // a request that has already failed once and carries attempt/error
    // metadata — not from a pristine, never-tried row (that scenario is
    // already covered by the plain "Race A" test above).
    await db.query(`UPDATE hr_lifecycle_cases SET status = 'IN_PROGRESS', completed_at = NULL WHERE id = $1`, [hrCase.id]);
    const failedFirst = await container.identityDeactivation.processOne(system, requestRow.id);
    assert.equal(failedFirst.outcome, "failed");
    await db.query(`UPDATE hr_lifecycle_cases SET status = 'COMPLETED', completed_at = NOW() WHERE id = $1`, [hrCase.id]);

    const [a, b] = await Promise.all([container.identityDeactivation.processOne(system, requestRow.id), container.identityDeactivation.processOne(system, requestRow.id)]);
    const outcomes = [a.outcome, b.outcome].sort();
    assert.deepEqual(outcomes, ["already_completed", "completed"]);

    const auditRows = await db.query<{ count: string }>(`SELECT count(*)::text FROM security_audit_events WHERE resource_id = $1 AND action = 'account.disabled'`, [identityUser.id]);
    assert.equal(auditRows.rows[0]!.count, "1", "exactly one committed completion, never two, even when retrying after a prior failure");
    assert.equal((await container.sessions.listActiveSessions(identityUser.id)).length, 0);
  });
});
