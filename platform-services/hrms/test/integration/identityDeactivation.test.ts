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

test("Failure/rollback: if the referenced case is not (or no longer) COMPLETED, processing fails cleanly, is recorded as FAILED without disabling anything, and a corrected retry succeeds", { skip }, async () => {
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
    const requestAfterFailure = await db.query<{ status: string; failure_reason: string | null }>(`SELECT status, failure_reason FROM hr_identity_deactivation_requests WHERE id = $1`, [requestRow.id]);
    assert.equal(requestAfterFailure.rows[0]!.status, "FAILED");
    assert.ok(requestAfterFailure.rows[0]!.failure_reason);

    // Correct the case back and retry — a FAILED request is retryable.
    await db.query(`UPDATE hr_lifecycle_cases SET status = 'COMPLETED', completed_at = NOW() WHERE id = $1`, [hrCase.id]);
    const retried = await container.identityDeactivation.processOne(system, requestRow.id);
    assert.equal(retried.outcome, "completed");
    const targetAfterRetry = await container.users.findById(identityUser.id);
    assert.equal(targetAfterRetry!.status, "disabled");
  });
});
