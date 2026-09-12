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
import { createPgOrgStructureRepository } from "../../src/repositories/postgres/pgOrgStructureRepository.ts";
import { createPgEmployeeRepository } from "../../src/repositories/postgres/pgEmployeeRepository.ts";
import { createPgEmploymentAssignmentRepository } from "../../src/repositories/postgres/pgEmploymentAssignmentRepository.ts";
import { createPgEmployeeCreationTransaction } from "../../src/repositories/postgres/pgEmployeeCreationTransaction.ts";
import { createPgEmploymentAssignmentTransaction } from "../../src/repositories/postgres/pgEmploymentAssignmentTransaction.ts";
import { createEmployeeService, PERMISSIONS } from "../../src/services/employeeService.ts";
import { createEmploymentAssignmentService } from "../../src/services/employmentAssignmentService.ts";

const skip: boolean | string = getTestDatabaseUrl()
  ? false
  : "DATABASE_URL not set — run against a real Postgres to exercise this suite (see CI).";

test("Organisation: employee numbers are server-generated from a shared sequence and never collide under concurrent creation", { skip }, async () => {
  await withTestDb(async (db) => {
    const employees = createPgEmployeeRepository(db);
    const admin = await createPgUserRepository(db).createUser({ email: "org.pg.empnum.admin@example.test", accountType: "employee" });

    const seqs = await Promise.all(Array.from({ length: 10 }, () => employees.nextEmployeeNumberSeq()));
    const unique = new Set(seqs);
    assert.equal(unique.size, 10, "concurrent sequence draws must never collide");

    const created = await employees.create({
      legalName: "Fictional PG Employee",
      employmentCountry: "MY",
      employeeNumber: `EMP-${String(seqs[0]).padStart(6, "0")}`,
      createdBy: admin.id,
    });
    assert.match(created.employeeNumber, /^EMP-\d{6}$/);
  });
});

test("Organisation: only one OPEN primary employment assignment per employee is allowed at the database level (partial unique index)", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const organisation = createPgOrganisationRepository(db);
    const employees = createPgEmployeeRepository(db);
    const assignments = createPgEmploymentAssignmentRepository(db);
    const admin = await users.createUser({ email: "org.pg.oneprimary.admin@example.test", accountType: "employee" });
    const [my] = await organisation.listLegalEntities();

    const employee = await employees.create({ legalName: "Fictional Primary Test", employmentCountry: "MY", employeeNumber: "EMP-900001", createdBy: admin.id });
    await assignments.create({
      employeeId: employee.id,
      legalEntityId: my!.id,
      employmentType: "full_time",
      status: "ACTIVE",
      isPrimary: true,
      startDate: "2026-01-01",
      effectiveFrom: "2026-01-01",
      createdBy: admin.id,
    } as never);

    await assert.rejects(
      () =>
        assignments.create({
          employeeId: employee.id,
          legalEntityId: my!.id,
          employmentType: "full_time",
          status: "ACTIVE",
          isPrimary: true,
          startDate: "2026-02-01",
          effectiveFrom: "2026-02-01",
          createdBy: admin.id,
        } as never),
      /duplicate key|unique constraint/i,
      "a second OPEN primary assignment for the same employee must be rejected at the DB level",
    );
  });
});

test("Organisation: a non-primary (secondary) assignment can coexist with an open primary assignment at the database level", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const organisation = createPgOrganisationRepository(db);
    const employees = createPgEmployeeRepository(db);
    const assignments = createPgEmploymentAssignmentRepository(db);
    const admin = await users.createUser({ email: "org.pg.secondary.admin@example.test", accountType: "employee" });
    const entities = await organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const sg = entities.find((e) => e.key === "sve-international-sg")!;

    const employee = await employees.create({ legalName: "Fictional Secondment Test", employmentCountry: "MY", employeeNumber: "EMP-900002", createdBy: admin.id });
    await assignments.create({
      employeeId: employee.id,
      legalEntityId: my.id,
      employmentType: "full_time",
      status: "ACTIVE",
      isPrimary: true,
      startDate: "2026-01-01",
      effectiveFrom: "2026-01-01",
      createdBy: admin.id,
    } as never);
    const secondment = await assignments.create({
      employeeId: employee.id,
      legalEntityId: sg.id,
      employmentType: "secondment",
      status: "ACTIVE",
      isPrimary: false,
      startDate: "2026-06-01",
      effectiveFrom: "2026-06-01",
      createdBy: admin.id,
    } as never);
    assert.equal(secondment.isPrimary, false);
  });
});

test("Organisation: self-reporting is rejected at the database level for positions (CHECK constraint)", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const organisation = createPgOrganisationRepository(db);
    const orgStructure = createPgOrgStructureRepository(db);
    await users.createUser({ email: "org.pg.posselfreport.admin@example.test", accountType: "employee" });
    const [my] = await organisation.listLegalEntities();
    const dept = await orgStructure.createDepartment({ legalEntityId: my!.id, name: "Fictional Dept", code: `FD-${randomUUID().slice(0, 6)}` });
    const position = await orgStructure.createPosition({ departmentId: dept.id, title: "Fictional Role" });

    await assert.rejects(
      () => db.query(`UPDATE positions SET reports_to_position_id = $1 WHERE id = $1`, [position.id]),
      /check constraint|positions_no_self_report/i,
    );
  });
});

test("Organisation: self-reporting is rejected at the database level for employment assignments (CHECK constraint)", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const organisation = createPgOrganisationRepository(db);
    const employees = createPgEmployeeRepository(db);
    const admin = await users.createUser({ email: "org.pg.assignselfreport.admin@example.test", accountType: "employee" });
    const [my] = await organisation.listLegalEntities();
    const employee = await employees.create({ legalName: "Fictional Self Report Test", employmentCountry: "MY", employeeNumber: "EMP-900003", createdBy: admin.id });

    const inserted = await db.query<{ id: string }>(
      `INSERT INTO employment_assignments(employee_id, legal_entity_id, employment_type, status, start_date, effective_from, created_by, updated_by)
       VALUES ($1, $2, 'full_time', 'ACTIVE', '2026-01-01', '2026-01-01', $3, $3) RETURNING id`,
      [employee.id, my!.id, admin.id],
    );
    const assignmentId = inserted.rows[0]!.id;

    await assert.rejects(
      () => db.query(`UPDATE employment_assignments SET reports_to_assignment_id = $1 WHERE id = $1`, [assignmentId]),
      /check constraint|employment_assignments_no_self_report/i,
    );
  });
});

test("Organisation: an unknown legal_entity_id on an employment assignment is rejected at the database level (foreign key)", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const employees = createPgEmployeeRepository(db);
    const admin = await users.createUser({ email: "org.pg.badentity.admin@example.test", accountType: "employee" });
    const employee = await employees.create({ legalName: "Fictional Bad Entity Test", employmentCountry: "MY", employeeNumber: "EMP-900004", createdBy: admin.id });

    await assert.rejects(() =>
      db.query(
        `INSERT INTO employment_assignments(employee_id, legal_entity_id, employment_type, status, start_date, effective_from, created_by, updated_by)
         VALUES ($1, $2, 'full_time', 'ACTIVE', '2026-01-01', '2026-01-01', $3, $3)`,
        [employee.id, randomUUID(), admin.id],
      ),
    );
  });
});

test("Organisation: an invalid employment status is rejected at the database level (CHECK constraint)", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const organisation = createPgOrganisationRepository(db);
    const employees = createPgEmployeeRepository(db);
    const admin = await users.createUser({ email: "org.pg.badstatus.admin@example.test", accountType: "employee" });
    const [my] = await organisation.listLegalEntities();
    const employee = await employees.create({ legalName: "Fictional Bad Status Test", employmentCountry: "MY", employeeNumber: "EMP-900005", createdBy: admin.id });

    await assert.rejects(() =>
      db.query(
        `INSERT INTO employment_assignments(employee_id, legal_entity_id, employment_type, status, start_date, effective_from, created_by, updated_by)
         VALUES ($1, $2, 'full_time', 'NOT_A_REAL_STATUS', '2026-01-01', '2026-01-01', $3, $3)`,
        [employee.id, my!.id, admin.id],
      ),
    );
  });
});

test("Organisation: user_employee_links allows only one ACTIVE link per user and per employee, while preserving unlinked history rows", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const organisation = createPgOrganisationRepository(db);
    const employees = createPgEmployeeRepository(db);
    const admin = await users.createUser({ email: "org.pg.link.admin@example.test", accountType: "employee" });
    const [my] = await organisation.listLegalEntities();
    void my;

    const employeeA = await employees.create({ legalName: "Fictional Link Employee A", employmentCountry: "MY", employeeNumber: "EMP-900006", createdBy: admin.id });
    const employeeB = await employees.create({ legalName: "Fictional Link Employee B", employmentCountry: "MY", employeeNumber: "EMP-900007", createdBy: admin.id });
    const userA = await users.createUser({ email: "org.pg.link.usera@example.test", accountType: "employee" });

    await users.linkEmployee({ userId: userA.id, employeeId: employeeA.id, linkedBy: admin.id });

    // Same user, second employee -> must be rejected while the first link is active.
    await assert.rejects(() => users.linkEmployee({ userId: userA.id, employeeId: employeeB.id, linkedBy: admin.id }));

    const activeLink = await users.findActiveLinkByUserId(userA.id);
    assert.ok(activeLink);
    await users.unlinkEmployee(activeLink!.id, admin.id);

    // After unlinking, the same user may be linked to a different employee, and the old row survives as history.
    await users.linkEmployee({ userId: userA.id, employeeId: employeeB.id, linkedBy: admin.id });
    const newActive = await users.findActiveLinkByUserId(userA.id);
    assert.equal(newActive?.employeeId, employeeB.id);

    const historyCount = await db.query<{ count: string }>(`SELECT count(*)::text FROM user_employee_links WHERE user_id = $1`, [userA.id]);
    assert.equal(historyCount.rows[0]!.count, "2", "the unlinked historical row must still exist, not be deleted");
  });
});

test("Organisation end-to-end through real Postgres: SK Lai & Partners requires the privileged permission tier even for an otherwise Group-wide administrator", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const organisation = createPgOrganisationRepository(db);
    const rbacRepo = createPgRbacRepository(db);
    const auditRepo = createPgAuditRepository(db);
    const orgStructureRepo = createPgOrgStructureRepository(db);
    const employeeRepo = createPgEmployeeRepository(db);
    const assignmentRepo = createPgEmploymentAssignmentRepository(db);
    const rbac = createRbacService({ rbac: rbacRepo, organisation });
    const audit = createAuditService({ audit: auditRepo });
    const employeeCreation = createPgEmployeeCreationTransaction(db);
    const employeeService = createEmployeeService({ employees: employeeRepo, assignments: assignmentRepo, orgStructure: orgStructureRepo, organisation, users, rbac, audit, employeeCreation });

    const entities = await organisation.listLegalEntities();
    const skl = entities.find((e) => e.key === "sk-lai-partners-my")!;
    const admin = await users.createUser({ email: "org.pg.skl.admin@example.test", accountType: "employee" });

    // Group-wide, but NOT privileged — the exact "System Administrator !=
    // HR Administrator" scenario the PR brief calls out.
    const groupAdmin = await users.createUser({ email: "org.pg.skl.groupadmin@example.test", accountType: "employee" });
    const role = await rbacRepo.createRole({ key: "org-e2e-group-admin", name: "Group Admin (non-privileged)" });
    const createPerm = await rbacRepo.createPermission({ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" });
    await rbacRepo.grantPermissionToRole(role.id, createPerm.id);
    await rbacRepo.assignRole({ userId: groupAdmin.id, roleId: role.id, grantedBy: admin.id });
    await rbacRepo.grantEntityAccess({ userId: groupAdmin.id, scopeType: "group", grantedBy: admin.id });

    await assert.rejects(
      () =>
        employeeService.createEmployee(
          { userId: groupAdmin.id, email: groupAdmin.email },
          {
            legalName: "Fictional SKL Employee",
            employmentCountry: "MY",
            initialAssignment: { legalEntityId: skl.id, employmentType: "full_time", startDate: "2026-01-01" },
          },
        ),
      "Group-wide CONFIDENTIAL-tier access must not be sufficient to create an SKL employee (RESTRICTED tier required)",
    );

    // Now grant the privileged tier explicitly — this must succeed.
    const privilegedPerm = await rbacRepo.createPermission({ key: PERMISSIONS.CREATE_PRIVILEGED, maxClassification: "RESTRICTED" });
    await rbacRepo.grantPermissionToRole(role.id, privilegedPerm.id);
    const employee = await employeeService.createEmployee(
      { userId: groupAdmin.id, email: groupAdmin.email },
      {
        legalName: "Fictional SKL Employee",
        employmentCountry: "MY",
        initialAssignment: { legalEntityId: skl.id, employmentType: "full_time", startDate: "2026-01-01" },
      },
    );
    assert.ok(employee.id);
  });
});

// ============================================================
// PR #6 review correction 1: transactional employee creation
// ============================================================
// See docs/architecture/organisation-employee-master.md "Transactional
// employee creation". employeeService.createEmployee() now wraps the
// employee row, its required initial employment assignment, and the
// follow-on status sync in one real Postgres transaction
// (EmployeeCreationTransaction) — a failure anywhere in that unit rolls
// back all of it; there is no delete-afterward compensation anywhere in
// the code.

async function provisionFullHr(
  db: Parameters<typeof createPgUserRepository>[0],
  rbacRepo: ReturnType<typeof createPgRbacRepository>,
  email: string,
  adminId: string,
) {
  const users = createPgUserRepository(db);
  const user = await users.createUser({ email, accountType: "employee" });
  const role = await rbacRepo.createRole({ key: `role-${randomUUID()}`, name: `Role for ${email}` });
  for (const key of [PERMISSIONS.CREATE, PERMISSIONS.READ, PERMISSIONS.READ_RESTRICTED]) {
    const existing = await rbacRepo.findPermissionByKey(key);
    const permission = existing ?? (await rbacRepo.createPermission({ key, maxClassification: "CONFIDENTIAL" }));
    await rbacRepo.grantPermissionToRole(role.id, permission.id);
  }
  await rbacRepo.assignRole({ userId: user.id, roleId: role.id, grantedBy: adminId });
  await rbacRepo.grantEntityAccess({ userId: user.id, scopeType: "group", grantedBy: adminId });
  return user;
}

test("Transactional employee creation: a successful creation commits both the employee row and its initial assignment together", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const organisation = createPgOrganisationRepository(db);
    const rbacRepo = createPgRbacRepository(db);
    const auditRepo = createPgAuditRepository(db);
    const orgStructureRepo = createPgOrgStructureRepository(db);
    const employeeRepo = createPgEmployeeRepository(db);
    const assignmentRepo = createPgEmploymentAssignmentRepository(db);
    const rbac = createRbacService({ rbac: rbacRepo, organisation });
    const audit = createAuditService({ audit: auditRepo });
    const employeeCreation = createPgEmployeeCreationTransaction(db);
    const employeeService = createEmployeeService({ employees: employeeRepo, assignments: assignmentRepo, orgStructure: orgStructureRepo, organisation, users, rbac, audit, employeeCreation });

    const entities = await organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const admin = await users.createUser({ email: "org.pg.txn.commit.admin@example.test", accountType: "employee" });
    const hr = await provisionFullHr(db, rbacRepo, "org.pg.txn.commit.hr@example.test", admin.id);

    const before = await db.query<{ count: string }>(`SELECT count(*)::text FROM employees`);
    const employee = await employeeService.createEmployee(
      { userId: hr.id, email: hr.email },
      { legalName: "Fictional Transaction Commit Test", employmentCountry: "MY", initialAssignment: { legalEntityId: my!.id, employmentType: "full_time", startDate: "2026-01-01" } },
    );
    const after = await db.query<{ count: string }>(`SELECT count(*)::text FROM employees`);
    assert.equal(Number(after.rows[0]!.count), Number(before.rows[0]!.count) + 1);

    const assignmentRows = await db.query<{ count: string }>(`SELECT count(*)::text FROM employment_assignments WHERE employee_id = $1`, [employee.id]);
    assert.equal(assignmentRows.rows[0]!.count, "1", "the initial assignment must be committed in the same transaction as the employee row");
  });
});

test("Transactional employee creation: a forced initial-assignment failure (invalid positionId) leaves neither the employee nor the assignment persisted", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const organisation = createPgOrganisationRepository(db);
    const rbacRepo = createPgRbacRepository(db);
    const auditRepo = createPgAuditRepository(db);
    const orgStructureRepo = createPgOrgStructureRepository(db);
    const employeeRepo = createPgEmployeeRepository(db);
    const assignmentRepo = createPgEmploymentAssignmentRepository(db);
    const rbac = createRbacService({ rbac: rbacRepo, organisation });
    const audit = createAuditService({ audit: auditRepo });
    const employeeCreation = createPgEmployeeCreationTransaction(db);
    const employeeService = createEmployeeService({ employees: employeeRepo, assignments: assignmentRepo, orgStructure: orgStructureRepo, organisation, users, rbac, audit, employeeCreation });

    const entities = await organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const admin = await users.createUser({ email: "org.pg.txn.rollback.admin@example.test", accountType: "employee" });
    const hr = await provisionFullHr(db, rbacRepo, "org.pg.txn.rollback.hr@example.test", admin.id);

    const beforeEmployees = await db.query<{ count: string }>(`SELECT count(*)::text FROM employees`);
    const beforeAssignments = await db.query<{ count: string }>(`SELECT count(*)::text FROM employment_assignments`);

    await assert.rejects(() =>
      employeeService.createEmployee(
        { userId: hr.id, email: hr.email },
        {
          legalName: "Fictional Orphan Test Employee",
          employmentCountry: "MY",
          initialAssignment: { legalEntityId: my!.id, employmentType: "full_time", startDate: "2026-01-01", positionId: randomUUID() },
        },
      ),
    );

    const afterEmployees = await db.query<{ count: string }>(`SELECT count(*)::text FROM employees`);
    const afterAssignments = await db.query<{ count: string }>(`SELECT count(*)::text FROM employment_assignments`);
    assert.equal(afterEmployees.rows[0]!.count, beforeEmployees.rows[0]!.count, "no orphan employee row must survive a failed initial-assignment insert");
    assert.equal(afterAssignments.rows[0]!.count, beforeAssignments.rows[0]!.count, "no partial assignment row must survive either");

    const named = await db.query<{ count: string }>(`SELECT count(*)::text FROM employees WHERE legal_name = 'Fictional Orphan Test Employee'`);
    assert.equal(named.rows[0]!.count, "0");
  });
});

test("Transactional employee creation: a duplicate work_email constraint failure leaves no partial employee row", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const organisation = createPgOrganisationRepository(db);
    const rbacRepo = createPgRbacRepository(db);
    const auditRepo = createPgAuditRepository(db);
    const orgStructureRepo = createPgOrgStructureRepository(db);
    const employeeRepo = createPgEmployeeRepository(db);
    const assignmentRepo = createPgEmploymentAssignmentRepository(db);
    const rbac = createRbacService({ rbac: rbacRepo, organisation });
    const audit = createAuditService({ audit: auditRepo });
    const employeeCreation = createPgEmployeeCreationTransaction(db);
    const employeeService = createEmployeeService({ employees: employeeRepo, assignments: assignmentRepo, orgStructure: orgStructureRepo, organisation, users, rbac, audit, employeeCreation });

    const entities = await organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const admin = await users.createUser({ email: "org.pg.txn.duplicate.admin@example.test", accountType: "employee" });
    const hr = await provisionFullHr(db, rbacRepo, "org.pg.txn.duplicate.hr@example.test", admin.id);
    const duplicateWorkEmail = "org.pg.txn.duplicate.workemail@example.test";

    const first = await employeeService.createEmployee(
      { userId: hr.id, email: hr.email },
      { legalName: "Fictional Duplicate Test One", workEmail: duplicateWorkEmail, employmentCountry: "MY", initialAssignment: { legalEntityId: my!.id, employmentType: "full_time", startDate: "2026-01-01" } },
    );

    await assert.rejects(() =>
      employeeService.createEmployee(
        { userId: hr.id, email: hr.email },
        { legalName: "Fictional Duplicate Test Two", workEmail: duplicateWorkEmail, employmentCountry: "MY", initialAssignment: { legalEntityId: my!.id, employmentType: "full_time", startDate: "2026-01-01" } },
      ),
    );

    const rows = await db.query<{ count: string }>(`SELECT count(*)::text FROM employees WHERE work_email = $1`, [duplicateWorkEmail]);
    assert.equal(rows.rows[0]!.count, "1", "the unique work_email constraint must reject the second create with no partial second employee row");
    const secondAssignments = await db.query<{ count: string }>(
      `SELECT count(*)::text FROM employment_assignments WHERE employee_id != $1`,
      [first.id],
    );
    assert.equal(secondAssignments.rows[0]!.count, "0", "no orphan assignment row for the failed second attempt");
  });
});

test("Transactional employee creation: audit never records a completed creation after a rollback", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const organisation = createPgOrganisationRepository(db);
    const rbacRepo = createPgRbacRepository(db);
    const auditRepo = createPgAuditRepository(db);
    const orgStructureRepo = createPgOrgStructureRepository(db);
    const employeeRepo = createPgEmployeeRepository(db);
    const assignmentRepo = createPgEmploymentAssignmentRepository(db);
    const rbac = createRbacService({ rbac: rbacRepo, organisation });
    const audit = createAuditService({ audit: auditRepo });
    const employeeCreation = createPgEmployeeCreationTransaction(db);
    const employeeService = createEmployeeService({ employees: employeeRepo, assignments: assignmentRepo, orgStructure: orgStructureRepo, organisation, users, rbac, audit, employeeCreation });

    const entities = await organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const admin = await users.createUser({ email: "org.pg.txn.auditrollback.admin@example.test", accountType: "employee" });
    const hr = await provisionFullHr(db, rbacRepo, "org.pg.txn.auditrollback.hr@example.test", admin.id);

    const beforeAudit = await db.query<{ count: string }>(`SELECT count(*)::text FROM security_audit_events WHERE action = 'employee_master.employee.created'`);

    await assert.rejects(() =>
      employeeService.createEmployee(
        { userId: hr.id, email: hr.email },
        {
          legalName: "Fictional Audit Rollback Test",
          employmentCountry: "MY",
          initialAssignment: { legalEntityId: my!.id, employmentType: "full_time", startDate: "2026-01-01", departmentId: randomUUID() },
        },
      ),
    );

    const afterAudit = await db.query<{ count: string }>(`SELECT count(*)::text FROM security_audit_events WHERE action = 'employee_master.employee.created'`);
    assert.equal(afterAudit.rows[0]!.count, beforeAudit.rows[0]!.count, "a rolled-back creation must never be recorded as a completed one in the audit trail");
  });
});

// ============================================================
// PR #6 review correction 2: reporting-cycle concurrency safety
// ============================================================
// See docs/architecture/organisation-employee-master.md "Reporting-cycle
// concurrency safety" for the full analysis: reports_to_assignment_id is
// set exactly once, at row creation, and (enforced by both application
// logic and a real foreign key) must reference a row that already exists —
// so a brand-new row can only ever point "backward" to something created
// strictly before it. Two purely concurrent creates can therefore never
// reference each other, and a cycle cannot form regardless of interleaving
// — this is a structural property of the data model, not merely something
// tested to be true today. createAssignment() nonetheless takes a
// transaction-scoped Postgres advisory lock (EmploymentAssignmentTransaction)
// whenever it introduces a new reportsToAssignmentId edge, as defense in
// depth against any future change that allows an existing row's reporting
// edge to be mutated in place (which would remove the structural guarantee
// above).

test("Reporting-cycle concurrency: two simultaneous, mutually-adversarial reporting changes cannot jointly commit a cycle", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const organisation = createPgOrganisationRepository(db);
    const rbacRepo = createPgRbacRepository(db);
    const auditRepo = createPgAuditRepository(db);
    const orgStructureRepo = createPgOrgStructureRepository(db);
    const employeeRepo = createPgEmployeeRepository(db);
    const assignmentRepo = createPgEmploymentAssignmentRepository(db);
    const employeeCreation = createPgEmployeeCreationTransaction(db);
    const assignmentTransactions = createPgEmploymentAssignmentTransaction(db);
    const rbac = createRbacService({ rbac: rbacRepo, organisation });
    const audit = createAuditService({ audit: auditRepo });
    const employeeService = createEmployeeService({ employees: employeeRepo, assignments: assignmentRepo, orgStructure: orgStructureRepo, organisation, users, rbac, audit, employeeCreation });
    const assignmentService = createEmploymentAssignmentService({ employees: employeeRepo, assignments: assignmentRepo, orgStructure: orgStructureRepo, organisation, rbac, audit, transactions: assignmentTransactions });

    const entities = await organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const admin = await users.createUser({ email: "org.pg.reportrace.admin@example.test", accountType: "employee" });
    const hr = await provisionFullHr(db, rbacRepo, "org.pg.reportrace.hr@example.test", admin.id);
    const managePerm = await rbacRepo.findPermissionByKey(PERMISSIONS.MANAGE_ASSIGNMENT);
    const reportingRole = await rbacRepo.createRole({ key: `role-${randomUUID()}`, name: "Reporting manager" });
    const managePermission = managePerm ?? (await rbacRepo.createPermission({ key: PERMISSIONS.MANAGE_ASSIGNMENT, maxClassification: "CONFIDENTIAL" }));
    const reportingPermission = await rbacRepo.createPermission({ key: PERMISSIONS.MANAGE_REPORTING, maxClassification: "CONFIDENTIAL" });
    await rbacRepo.grantPermissionToRole(reportingRole.id, managePermission.id);
    await rbacRepo.grantPermissionToRole(reportingRole.id, reportingPermission.id);
    await rbacRepo.assignRole({ userId: hr.id, roleId: reportingRole.id, grantedBy: admin.id });

    for (let iteration = 0; iteration < 5; iteration++) {
      const employeeX = await employeeService.createEmployee(
        { userId: hr.id, email: hr.email },
        { legalName: `Fictional Race Employee X ${iteration}`, employmentCountry: "MY", initialAssignment: { legalEntityId: my!.id, employmentType: "full_time", startDate: "2026-01-01" } },
      );
      const employeeY = await employeeService.createEmployee(
        { userId: hr.id, email: hr.email },
        { legalName: `Fictional Race Employee Y ${iteration}`, employmentCountry: "MY", initialAssignment: { legalEntityId: my!.id, employmentType: "full_time", startDate: "2026-01-01" } },
      );
      const x0 = (await assignmentService.listAssignments({ userId: hr.id, email: hr.email }, employeeX.id))[0]!;
      const y0 = (await assignmentService.listAssignments({ userId: hr.id, email: hr.email }, employeeY.id))[0]!;

      // Concurrently: X's (secondary) assignment reports to Y0, and Y's
      // (secondary) assignment reports to X0 — each targets the OTHER
      // employee's already-committed, pre-race assignment, submitted at
      // the same time via Promise.all so neither request can possibly know
      // the other's outcome or any row it creates.
      const results = await Promise.allSettled([
        assignmentService.createAssignment(
          { userId: hr.id, email: hr.email },
          employeeX.id,
          { legalEntityId: my!.id, employmentType: "full_time", status: "ACTIVE", isPrimary: false, startDate: "2026-06-01", effectiveFrom: "2026-06-01", reportsToAssignmentId: y0.id },
        ),
        assignmentService.createAssignment(
          { userId: hr.id, email: hr.email },
          employeeY.id,
          { legalEntityId: my!.id, employmentType: "full_time", status: "ACTIVE", isPrimary: false, startDate: "2026-06-01", effectiveFrom: "2026-06-01", reportsToAssignmentId: x0.id },
        ),
      ]);

      // Neither request could reference the other's not-yet-existing row,
      // so this specific configuration cannot cycle even in principle —
      // both are expected to succeed. The invariant this test actually
      // guards is checked below: whatever committed, the resulting graph
      // for these two employees must be acyclic.
      for (const result of results) {
        assert.equal(result.status, "fulfilled", result.status === "rejected" ? String(result.reason) : undefined);
      }

      const allRows = await db.query<{ id: string; employee_id: string; reports_to_assignment_id: string | null }>(
        `SELECT id, employee_id, reports_to_assignment_id FROM employment_assignments WHERE employee_id = $1 OR employee_id = $2`,
        [employeeX.id, employeeY.id],
      );
      const byId = new Map(allRows.rows.map((r) => [r.id, r]));
      for (const row of allRows.rows) {
        const visited = new Set<string>();
        let current: typeof row | undefined = row;
        while (current) {
          assert.ok(!visited.has(current.id), "the reporting hierarchy must remain acyclic after any committed mutation");
          visited.add(current.id);
          current = current.reports_to_assignment_id ? byId.get(current.reports_to_assignment_id) : undefined;
        }
      }
    }
  });
});

test("Reporting-cycle concurrency: self-reporting, ordinary multi-hop cycle detection, valid changes, and assignment history all remain correct through the locked/transactional path", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const organisation = createPgOrganisationRepository(db);
    const rbacRepo = createPgRbacRepository(db);
    const auditRepo = createPgAuditRepository(db);
    const orgStructureRepo = createPgOrgStructureRepository(db);
    const employeeRepo = createPgEmployeeRepository(db);
    const assignmentRepo = createPgEmploymentAssignmentRepository(db);
    const employeeCreation = createPgEmployeeCreationTransaction(db);
    const assignmentTransactions = createPgEmploymentAssignmentTransaction(db);
    const rbac = createRbacService({ rbac: rbacRepo, organisation });
    const audit = createAuditService({ audit: auditRepo });
    const employeeService = createEmployeeService({ employees: employeeRepo, assignments: assignmentRepo, orgStructure: orgStructureRepo, organisation, users, rbac, audit, employeeCreation });
    const assignmentService = createEmploymentAssignmentService({ employees: employeeRepo, assignments: assignmentRepo, orgStructure: orgStructureRepo, organisation, rbac, audit, transactions: assignmentTransactions });

    const entities = await organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const admin = await users.createUser({ email: "org.pg.reportcorrect.admin@example.test", accountType: "employee" });
    const hr = await provisionFullHr(db, rbacRepo, "org.pg.reportcorrect.hr@example.test", admin.id);
    const managePermission = (await rbacRepo.findPermissionByKey(PERMISSIONS.MANAGE_ASSIGNMENT)) ?? (await rbacRepo.createPermission({ key: PERMISSIONS.MANAGE_ASSIGNMENT, maxClassification: "CONFIDENTIAL" }));
    const reportingPermission = (await rbacRepo.findPermissionByKey(PERMISSIONS.MANAGE_REPORTING)) ?? (await rbacRepo.createPermission({ key: PERMISSIONS.MANAGE_REPORTING, maxClassification: "CONFIDENTIAL" }));
    const role = await rbacRepo.createRole({ key: `role-${randomUUID()}`, name: "Reporting manager 2" });
    await rbacRepo.grantPermissionToRole(role.id, managePermission.id);
    await rbacRepo.grantPermissionToRole(role.id, reportingPermission.id);
    await rbacRepo.assignRole({ userId: hr.id, roleId: role.id, grantedBy: admin.id });
    const actor = { userId: hr.id, email: hr.email };

    const employeeA = await employeeService.createEmployee(actor, { legalName: "Fictional Reporting Correctness A", employmentCountry: "MY", initialAssignment: { legalEntityId: my!.id, employmentType: "full_time", startDate: "2026-01-01" } });
    const employeeB = await employeeService.createEmployee(actor, { legalName: "Fictional Reporting Correctness B", employmentCountry: "MY", initialAssignment: { legalEntityId: my!.id, employmentType: "full_time", startDate: "2026-01-01" } });
    const a0 = (await assignmentService.listAssignments(actor, employeeA.id))[0]!;

    // Self-reporting remains rejected.
    await assert.rejects(() =>
      assignmentService.createAssignment(actor, employeeA.id, {
        legalEntityId: my!.id, employmentType: "full_time", status: "ACTIVE", startDate: "2026-06-01", effectiveFrom: "2026-06-01", reportsToAssignmentId: a0.id,
      }),
    );

    // B reports to A — a valid, non-circular change — still succeeds.
    const bReportsToA = await assignmentService.createAssignment(actor, employeeB.id, {
      legalEntityId: my!.id, employmentType: "full_time", status: "ACTIVE", startDate: "2026-06-01", effectiveFrom: "2026-06-01", reportsToAssignmentId: a0.id,
    });
    assert.equal(bReportsToA.reportsToAssignmentId, a0.id);

    // A -> B -> A ordinary (sequential, deterministic) multi-hop cycle detection still works through the transactional path.
    await assert.rejects(() =>
      assignmentService.createAssignment(actor, employeeA.id, {
        legalEntityId: my!.id, employmentType: "full_time", status: "ACTIVE", startDate: "2026-07-01", effectiveFrom: "2026-07-01", reportsToAssignmentId: bReportsToA.id,
      }),
    );

    // Effective-dated assignment history remains intact: A's original hire row is preserved (closed, not deleted) after the rejected transition attempt above never touched it, and after a real transition does close it correctly.
    const historyBefore = await assignmentService.listAssignments(actor, employeeA.id);
    assert.equal(historyBefore.length, 1, "the rejected circular-reporting attempt must not have created or altered any row");

    const transitioned = await assignmentService.createAssignment(actor, employeeA.id, {
      legalEntityId: my!.id, employmentType: "full_time", status: "ACTIVE", startDate: "2026-08-01", effectiveFrom: "2026-08-01", changeReason: "Fictional department move",
    });
    const historyAfter = await assignmentService.listAssignments(actor, employeeA.id);
    assert.equal(historyAfter.length, 2, "a valid transition still creates history rather than overwriting");
    assert.ok(historyAfter.some((row) => row.id === a0.id && row.effectiveTo !== null), "the original row is preserved, closed, not deleted");
    assert.ok(historyAfter.some((row) => row.id === transitioned.id && row.effectiveTo === null));
  });
});
