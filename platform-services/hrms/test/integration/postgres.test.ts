import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { withTestDb, getTestDatabaseUrl } from "./testDb.ts";
import { createPgUserRepository } from "../../../identity/src/repositories/postgres/pgUserRepository.ts";
import { createPgOrganisationRepository } from "../../../identity/src/repositories/postgres/pgOrganisationRepository.ts";
import { createPgRbacRepository } from "../../../identity/src/repositories/postgres/pgRbacRepository.ts";
import { createPgAuditRepository } from "../../../identity/src/repositories/postgres/pgAuditRepository.ts";
import { createRbacService } from "../../../identity/src/services/rbacService.ts";
import { createAuditService } from "../../../identity/src/services/auditService.ts";

import { createPgOrgStructureRepository } from "../../../organisation/src/repositories/postgres/pgOrgStructureRepository.ts";
import { createPgEmployeeRepository } from "../../../organisation/src/repositories/postgres/pgEmployeeRepository.ts";
import { createPgEmploymentAssignmentRepository } from "../../../organisation/src/repositories/postgres/pgEmploymentAssignmentRepository.ts";
import { createPgEmployeeCreationTransaction } from "../../../organisation/src/repositories/postgres/pgEmployeeCreationTransaction.ts";
import { createPgEmploymentAssignmentTransaction } from "../../../organisation/src/repositories/postgres/pgEmploymentAssignmentTransaction.ts";
import { createEmployeeService, PERMISSIONS as ORG_PERMISSIONS } from "../../../organisation/src/services/employeeService.ts";
import { createEmploymentAssignmentService } from "../../../organisation/src/services/employmentAssignmentService.ts";

import { createPgLifecycleCaseRepository } from "../../src/repositories/postgres/pgLifecycleCaseRepository.ts";
import { createPgLifecycleEventRepository } from "../../src/repositories/postgres/pgLifecycleEventRepository.ts";
import { createPgLifecycleMilestoneRepository } from "../../src/repositories/postgres/pgLifecycleMilestoneRepository.ts";
import { createPgProbationReviewRepository } from "../../src/repositories/postgres/pgProbationReviewRepository.ts";
import { createPgLifecycleTransaction } from "../../src/repositories/postgres/pgLifecycleTransaction.ts";
import { createLifecycleCaseService } from "../../src/services/lifecycleCaseService.ts";
import { createOnboardingService } from "../../src/services/onboardingService.ts";
import { createProbationService } from "../../src/services/probationService.ts";
import { createEmploymentChangeService } from "../../src/services/employmentChangeService.ts";
import { createOffboardingService } from "../../src/services/offboardingService.ts";
import { PERMISSIONS } from "../../src/services/access.ts";

const skip: boolean | string = getTestDatabaseUrl() ? false : "DATABASE_URL not set — run against a real Postgres to exercise this suite (see CI).";

function buildContainer(db: Parameters<typeof createPgUserRepository>[0]) {
  const users = createPgUserRepository(db);
  const organisation = createPgOrganisationRepository(db);
  const rbacRepo = createPgRbacRepository(db);
  const auditRepo = createPgAuditRepository(db);
  const rbac = createRbacService({ rbac: rbacRepo, organisation });
  const audit = createAuditService({ audit: auditRepo });

  const orgStructureRepo = createPgOrgStructureRepository(db);
  const employeeRepo = createPgEmployeeRepository(db);
  const assignmentRepo = createPgEmploymentAssignmentRepository(db);
  const employeeCreation = createPgEmployeeCreationTransaction(db);
  const assignmentTransactions = createPgEmploymentAssignmentTransaction(db);
  const employees = createEmployeeService({ employees: employeeRepo, assignments: assignmentRepo, orgStructure: orgStructureRepo, organisation, users, rbac, audit, employeeCreation });
  const orgAssignments = createEmploymentAssignmentService({ employees: employeeRepo, assignments: assignmentRepo, orgStructure: orgStructureRepo, organisation, users, rbac, audit, transactions: assignmentTransactions });

  const caseRepo = createPgLifecycleCaseRepository(db);
  const eventRepo = createPgLifecycleEventRepository(db);
  const milestoneRepo = createPgLifecycleMilestoneRepository(db);
  const reviewRepo = createPgProbationReviewRepository(db);
  const transactions = createPgLifecycleTransaction(db);

  const lifecycle = createLifecycleCaseService({ cases: caseRepo, events: eventRepo, milestones: milestoneRepo, organisation, users, rbac, audit, transactions, assignments: orgAssignments });
  const onboarding = createOnboardingService({ lifecycle });
  const probation = createProbationService({ lifecycle, cases: caseRepo, reviews: reviewRepo, organisation, rbac, audit });
  const employmentChange = createEmploymentChangeService({ lifecycle, cases: caseRepo, organisation, rbac, orgAssignments });
  const offboarding = createOffboardingService({ lifecycle, cases: caseRepo, organisation, rbac, orgAssignments });

  return { users, organisation, rbacRepo, rbac, audit, employees, orgAssignments, caseRepo, eventRepo, reviewRepo, lifecycle, onboarding, probation, employmentChange, offboarding };
}

async function provisionFullHr(c: ReturnType<typeof buildContainer>, email: string, adminId: string) {
  const user = await c.users.createUser({ email, accountType: "employee" });
  const role = await c.rbacRepo.createRole({ key: `role-${randomUUID()}`, name: `Role for ${email}` });
  for (const key of [PERMISSIONS.CREATE, PERMISSIONS.READ, PERMISSIONS.READ_RESTRICTED, PERMISSIONS.READ_DECISION, PERMISSIONS.MANAGE_ONBOARDING, PERMISSIONS.MANAGE_PROBATION, PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, PERMISSIONS.MANAGE_OFFBOARDING, PERMISSIONS.COMPLETE]) {
    const existing = await c.rbacRepo.findPermissionByKey(key);
    const permission = existing ?? (await c.rbacRepo.createPermission({ key, maxClassification: "CONFIDENTIAL" }));
    await c.rbacRepo.grantPermissionToRole(role.id, permission.id);
  }
  const orgRole = await c.rbacRepo.createRole({ key: `role-org-${randomUUID()}`, name: `Org role for ${email}` });
  for (const key of [ORG_PERMISSIONS.CREATE, ORG_PERMISSIONS.READ, ORG_PERMISSIONS.READ_RESTRICTED, ORG_PERMISSIONS.MANAGE_ASSIGNMENT]) {
    const existing = await c.rbacRepo.findPermissionByKey(key);
    const permission = existing ?? (await c.rbacRepo.createPermission({ key, maxClassification: "CONFIDENTIAL" }));
    await c.rbacRepo.grantPermissionToRole(orgRole.id, permission.id);
  }
  await c.rbacRepo.assignRole({ userId: user.id, roleId: role.id, grantedBy: adminId });
  await c.rbacRepo.assignRole({ userId: user.id, roleId: orgRole.id, grantedBy: adminId });
  await c.rbacRepo.grantEntityAccess({ userId: user.id, scopeType: "group", grantedBy: adminId });
  return user;
}

async function hireFictional(c: ReturnType<typeof buildContainer>, hr: { id: string; email: string }, legalEntityId: string, legalName: string) {
  return c.employees.createEmployee({ userId: hr.id, email: hr.email }, { legalName, employmentCountry: "MY", initialAssignment: { legalEntityId, employmentType: "full_time", startDate: "2026-01-01" } });
}

/** Minimal raw employee row for low-level constraint tests that need a valid employee_id FK target but don't exercise Employee Master's own service layer. */
async function insertFictionalEmployeeRow(db: Parameters<typeof createPgUserRepository>[0], adminId: string): Promise<string> {
  const result = await db.query<{ id: string }>(
    `INSERT INTO employees(employee_number, legal_name, employment_country, created_by, updated_by) VALUES ($1, 'Fictional Constraint Test Employee', 'MY', $2, $2) RETURNING id`,
    [`EMP-${randomUUID().slice(0, 6)}`, adminId],
  );
  return result.rows[0]!.id;
}

test("HRMS: case numbers are server-generated from a shared sequence and never collide under concurrent creation", { skip }, async () => {
  await withTestDb(async (db) => {
    const c = buildContainer(db);
    const seqs = await Promise.all(Array.from({ length: 10 }, () => c.caseRepo.nextCaseNumberSeq()));
    assert.equal(new Set(seqs).size, 10, "concurrent sequence draws must never collide");
  });
});

test("HRMS: case creation + initial event commit atomically; a forced failure leaves no orphan case row", { skip }, async () => {
  await withTestDb(async (db) => {
    const c = buildContainer(db);
    const admin = await c.users.createUser({ email: "hrms.pg.txn.admin@example.test", accountType: "employee" });
    const hr = await provisionFullHr(c, "hrms.pg.txn.hr@example.test", admin.id);
    const entities = await c.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const employee = await hireFictional(c, hr, my!.id, "Fictional HRMS Txn Test");

    const before = await db.query<{ count: string }>(`SELECT count(*)::text FROM hr_lifecycle_cases`);
    const created = await c.onboarding.createOnboardingCase({ userId: hr.id, email: hr.email }, { employeeId: employee.id, legalEntityId: my!.id, hrOwnerUserId: hr.id });
    const after = await db.query<{ count: string }>(`SELECT count(*)::text FROM hr_lifecycle_cases`);
    assert.equal(Number(after.rows[0]!.count), Number(before.rows[0]!.count) + 1);

    const eventRows = await db.query<{ count: string }>(`SELECT count(*)::text FROM hr_lifecycle_events WHERE case_id = $1`, [created.id]);
    assert.equal(eventRows.rows[0]!.count, "1", "the opening event must be committed in the same transaction as the case row");

    // Force a failure inside the SAME transaction (an invalid responsibleHrOwnerUserId FK on the initial probation review) and confirm no case/event survives.
    const beforeFail = await db.query<{ count: string }>(`SELECT count(*)::text FROM hr_lifecycle_cases`);
    await assert.rejects(() =>
      c.lifecycle.createCase(
        { userId: hr.id, email: hr.email },
        { employeeId: employee.id, legalEntityId: my!.id, lifecycleType: "probation", hrOwnerUserId: hr.id },
        {},
        async (repos, createdCase) => {
          await repos.reviews.create({ caseId: createdCase.id, sequenceNumber: 1, periodStart: "2026-01-01", expectedReviewDate: "2026-04-01", responsibleManagerUserId: null, responsibleHrOwnerUserId: randomUUID() });
        },
      ),
    );
    const afterFail = await db.query<{ count: string }>(`SELECT count(*)::text FROM hr_lifecycle_cases`);
    assert.equal(afterFail.rows[0]!.count, beforeFail.rows[0]!.count, "no orphan case row must survive a failed additional write in the same transaction");
  });
});

test("HRMS: hr_lifecycle_cases CHECK constraints reject invalid lifecycle_type/status and enforce completed_at/cancelled_at consistency", { skip }, async () => {
  await withTestDb(async (db) => {
    const c = buildContainer(db);
    const admin = await c.users.createUser({ email: "hrms.pg.rowchecks.admin@example.test", accountType: "employee" });
    const entities = await c.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const employeeId = await insertFictionalEmployeeRow(db, admin.id);

    await assert.rejects(() =>
      db.query(
        `INSERT INTO hr_lifecycle_cases(case_number, employee_id, legal_entity_id, lifecycle_type, hr_owner_user_id, created_by, updated_by)
         VALUES ('HR-500001', $1, $2, 'not_a_real_type', $3, $3, $3)`,
        [employeeId, my!.id, admin.id],
      ),
      /check constraint|lifecycle_type/i,
    );

    await assert.rejects(() =>
      db.query(
        `INSERT INTO hr_lifecycle_cases(case_number, employee_id, legal_entity_id, lifecycle_type, status, hr_owner_user_id, created_by, updated_by)
         VALUES ('HR-500002', $1, $2, 'onboarding', 'NOT_A_STATUS', $3, $3, $3)`,
        [employeeId, my!.id, admin.id],
      ),
      /check constraint|status/i,
    );

    // completed_at must be set iff status = COMPLETED.
    await assert.rejects(() =>
      db.query(
        `INSERT INTO hr_lifecycle_cases(case_number, employee_id, legal_entity_id, lifecycle_type, status, hr_owner_user_id, created_by, updated_by, completed_at)
         VALUES ('HR-500003', $1, $2, 'onboarding', 'IN_PROGRESS', $3, $3, $3, NOW())`,
        [employeeId, my!.id, admin.id],
      ),
      /check constraint|completed_at/i,
    );
  });
});

test("HRMS: hr_probation_reviews CHECK constraints enforce a valid date range and decision/review_status consistency", { skip }, async () => {
  await withTestDb(async (db) => {
    const c = buildContainer(db);
    const admin = await c.users.createUser({ email: "hrms.pg.reviewchecks.admin@example.test", accountType: "employee" });
    const entities = await c.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const employeeId = await insertFictionalEmployeeRow(db, admin.id);
    const caseRow = await db.query<{ id: string }>(
      `INSERT INTO hr_lifecycle_cases(case_number, employee_id, legal_entity_id, lifecycle_type, hr_owner_user_id, created_by, updated_by)
       VALUES ('HR-500010', $1, $2, 'probation', $3, $3, $3) RETURNING id`,
      [employeeId, my!.id, admin.id],
    );
    const caseId = caseRow.rows[0]!.id;

    // expected_review_date before period_start.
    await assert.rejects(() =>
      db.query(
        `INSERT INTO hr_probation_reviews(case_id, sequence_number, period_start, expected_review_date, responsible_hr_owner_user_id)
         VALUES ($1, 1, '2026-05-01', '2026-01-01', $2)`,
        [caseId, admin.id],
      ),
    );

    // review_status COMPLETED without a decision.
    await assert.rejects(() =>
      db.query(
        `INSERT INTO hr_probation_reviews(case_id, sequence_number, period_start, expected_review_date, responsible_hr_owner_user_id, review_status)
         VALUES ($1, 1, '2026-01-01', '2026-04-01', $2, 'COMPLETED')`,
        [caseId, admin.id],
      ),
    );

    // A duplicate sequence_number for the same case is rejected.
    await db.query(`INSERT INTO hr_probation_reviews(case_id, sequence_number, period_start, expected_review_date, responsible_hr_owner_user_id) VALUES ($1, 1, '2026-01-01', '2026-04-01', $2)`, [caseId, admin.id]);
    await assert.rejects(() => db.query(`INSERT INTO hr_probation_reviews(case_id, sequence_number, period_start, expected_review_date, responsible_hr_owner_user_id) VALUES ($1, 1, '2026-05-01', '2026-08-01', $2)`, [caseId, admin.id]));
  });
});

test("HRMS end-to-end through real Postgres: SK Lai & Partners requires the privileged permission tier even for an otherwise Group-wide HR administrator", { skip }, async () => {
  await withTestDb(async (db) => {
    const c = buildContainer(db);
    const admin = await c.users.createUser({ email: "hrms.pg.skl.admin@example.test", accountType: "employee" });
    const entities = await c.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const skl = entities.find((e) => e.key === "sk-lai-partners-my")!;

    const groupHr = await c.users.createUser({ email: "hrms.pg.skl.grouphr@example.test", accountType: "employee" });
    const role = await c.rbacRepo.createRole({ key: "hrms-e2e-group-hr", name: "Group HR (non-privileged)" });
    const createPerm = await c.rbacRepo.createPermission({ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" });
    await c.rbacRepo.grantPermissionToRole(role.id, createPerm.id);
    await c.rbacRepo.assignRole({ userId: groupHr.id, roleId: role.id, grantedBy: admin.id });
    await c.rbacRepo.grantEntityAccess({ userId: groupHr.id, scopeType: "group", grantedBy: admin.id });

    // Employee is hired via a privileged org actor (setup-only), but the case-creation caller is the non-privileged Group HR user.
    const orgAdminRole = await c.rbacRepo.createRole({ key: "hrms-e2e-org-admin", name: "Org admin for setup" });
    const orgCreatePriv = await c.rbacRepo.createPermission({ key: ORG_PERMISSIONS.CREATE_PRIVILEGED, maxClassification: "RESTRICTED" });
    await c.rbacRepo.grantPermissionToRole(orgAdminRole.id, orgCreatePriv.id);
    await c.rbacRepo.assignRole({ userId: admin.id, roleId: orgAdminRole.id, grantedBy: admin.id });
    await c.rbacRepo.grantEntityAccess({ userId: admin.id, scopeType: "group", grantedBy: admin.id });
    const sklEmployee = await c.employees.createEmployee({ userId: admin.id, email: admin.email }, { legalName: "Fictional SKL HRMS Employee", employmentCountry: "MY", initialAssignment: { legalEntityId: skl.id, employmentType: "full_time", startDate: "2026-01-01" } });

    await assert.rejects(
      () => c.onboarding.createOnboardingCase({ userId: groupHr.id, email: groupHr.email }, { employeeId: sklEmployee.id, legalEntityId: skl.id, hrOwnerUserId: groupHr.id }),
      "Group-wide CONFIDENTIAL-tier HR access must not be sufficient to open an SKL lifecycle case",
    );

    const privilegedPerm = await c.rbacRepo.createPermission({ key: PERMISSIONS.CREATE_PRIVILEGED, maxClassification: "RESTRICTED" });
    await c.rbacRepo.grantPermissionToRole(role.id, privilegedPerm.id);
    const created = await c.onboarding.createOnboardingCase({ userId: groupHr.id, email: groupHr.email }, { employeeId: sklEmployee.id, legalEntityId: skl.id, hrOwnerUserId: groupHr.id });
    assert.ok(created.id);
    void my;
  });
});

test("HRMS: a completed employment-change case's resultingAssignmentId points at a real, committed Organisation employment_assignments row", { skip }, async () => {
  await withTestDb(async (db) => {
    const c = buildContainer(db);
    const admin = await c.users.createUser({ email: "hrms.pg.change.admin@example.test", accountType: "employee" });
    const hr = await provisionFullHr(c, "hrms.pg.change.hr@example.test", admin.id);
    const entities = await c.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const employee = await hireFictional(c, hr, my!.id, "Fictional PG Employment Change Test");

    const created = await c.employmentChange.createChangeCase({ userId: hr.id, email: hr.email }, { employeeId: employee.id, legalEntityId: my!.id, hrOwnerUserId: hr.id, changeType: "promotion" });
    const result = await c.employmentChange.completeChange({ userId: hr.id, email: hr.email }, created.id, { legalEntityId: my!.id, employmentType: "full_time", status: "ACTIVE", startDate: "2026-07-01", effectiveFrom: "2026-07-01" });

    const assignmentRow = await db.query<{ id: string }>(`SELECT id FROM employment_assignments WHERE id = $1`, [result.assignment.id]);
    assert.equal(assignmentRow.rows.length, 1, "the resultingAssignmentId must reference a real, committed row in Organisation's own table");
    const caseRow = await db.query<{ status: string; resulting_assignment_id: string }>(`SELECT status, resulting_assignment_id FROM hr_lifecycle_cases WHERE id = $1`, [created.id]);
    assert.equal(caseRow.rows[0]!.status, "COMPLETED");
    assert.equal(caseRow.rows[0]!.resulting_assignment_id, result.assignment.id);
  });
});
