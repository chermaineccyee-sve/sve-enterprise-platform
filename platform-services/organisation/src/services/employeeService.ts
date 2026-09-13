/**
 * Employee Master domain service — Organisation's first real business-data
 * consumer of Identity's RBAC foundation, following the exact pattern
 * platform-services/data-vault established (two-tier ordinary/.privileged
 * permission keys standing in for a classification ceiling Identity's
 * rbacService already enforces — see src/services/entityClassification.ts
 * for why SK Lai & Partners always requires the .privileged tier).
 *
 * Dependency direction: this file (Organisation) depends on Identity's
 * RbacService/AuditService/OrganisationRepository/UserRepository
 * *contracts* — imported from platform-services/identity's source tree,
 * never copied or reimplemented here. platform-services/identity has no
 * corresponding dependency on this package.
 */
import type { EmployeeRepository, EmploymentAssignmentRepository, OrgStructureRepository, EmployeeCreationTransaction } from "../repositories/types.ts";
import type { RbacService } from "../../../identity/src/services/rbacService.ts";
import type { AuditService } from "../../../identity/src/services/auditService.ts";
import type { OrganisationRepository, UserRepository } from "../../../identity/src/repositories/types.ts";
import { ForbiddenError } from "../../../identity/src/domain/errors.ts";
import { NotFoundError, ValidationError } from "../domain/errors.ts";
import type { Employee, EmployeeFilter, CreateEmployeeInput, UpdateEmployeeInput, CreateAssignmentInput } from "../domain/employee.ts";
import type { DataClassification } from "../../../../packages/types/src/entity-context.ts";
import { classificationCeilingForEntity, restrictedFieldClassificationCeiling } from "./entityClassification.ts";
import { formatEmployeeNumber } from "../domain/employeeNumber.ts";

export const PERMISSIONS = {
  READ: "employee_master.read",
  READ_PRIVILEGED: "employee_master.read.privileged",
  READ_RESTRICTED: "employee_master.read.restricted",
  READ_RESTRICTED_PRIVILEGED: "employee_master.read.restricted.privileged",
  READ_TEAM: "employee_master.read.team",
  CREATE: "employee_master.create",
  CREATE_PRIVILEGED: "employee_master.create.privileged",
  UPDATE: "employee_master.update",
  UPDATE_PRIVILEGED: "employee_master.update.privileged",
  MANAGE_ASSIGNMENT: "employee_master.manage_assignment",
  MANAGE_ASSIGNMENT_PRIVILEGED: "employee_master.manage_assignment.privileged",
  MANAGE_REPORTING: "employee_master.manage_reporting",
  MANAGE_REPORTING_PRIVILEGED: "employee_master.manage_reporting.privileged",
  LINK_IDENTITY: "employee_master.link_identity",
  LINK_IDENTITY_PRIVILEGED: "employee_master.link_identity.privileged",
} as const;

interface ActorContext {
  userId: string;
  email: string;
  ip?: string | null;
  userAgent?: string | null;
}

async function checkAccess(rbac: RbacService, userId: string, baseKey: string, privilegedKey: string, target: { legalEntityId?: string; recordClassification?: DataClassification }) {
  const base = await rbac.authorize({ userId, permissionKey: baseKey, target });
  if (base.allowed) return base;
  return rbac.authorize({ userId, permissionKey: privilegedKey, target });
}

export interface EmployeeView {
  employee: Employee;
  currentAssignment: import("../domain/employee.ts").EmploymentAssignment | null;
  /** Whether restricted-HR fields (status, dates, probation, termination, history) may be shown for this employee — directory-level fields are always included once this view is returned at all. */
  canReadRestricted: boolean;
}

export function createEmployeeService(deps: {
  employees: EmployeeRepository;
  assignments: EmploymentAssignmentRepository;
  orgStructure: OrgStructureRepository;
  organisation: OrganisationRepository;
  users: UserRepository;
  rbac: RbacService;
  audit: AuditService;
  employeeCreation: EmployeeCreationTransaction;
}) {
  async function findActiveEmployeeIdForUser(userId: string): Promise<string | null> {
    const link = await deps.users.findActiveLinkByUserId(userId);
    return link?.employeeId ?? null;
  }

  async function isDirectManagerOf(actorUserId: string, targetAssignment: import("../domain/employee.ts").EmploymentAssignment): Promise<boolean> {
    const actorEmployeeId = await findActiveEmployeeIdForUser(actorUserId);
    if (!actorEmployeeId) return false;
    const actorAssignment = await deps.assignments.findCurrentPrimary(actorEmployeeId);
    if (!actorAssignment) return false;
    if (targetAssignment.reportsToAssignmentId === actorAssignment.id) return true;
    if (targetAssignment.positionId) {
      const position = await deps.orgStructure.findPositionById(targetAssignment.positionId);
      if (position?.reportsToPositionId && actorAssignment.positionId && position.reportsToPositionId === actorAssignment.positionId) return true;
    }
    return false;
  }

  async function classificationTargetsFor(assignment: import("../domain/employee.ts").EmploymentAssignment | null) {
    if (!assignment) return { base: {}, restricted: {} };
    const legalEntity = await deps.organisation.findLegalEntityById(assignment.legalEntityId);
    if (!legalEntity) return { base: {}, restricted: {} };
    const baseCeiling = classificationCeilingForEntity(legalEntity);
    return {
      base: { legalEntityId: legalEntity.id, recordClassification: baseCeiling },
      restricted: { legalEntityId: legalEntity.id, recordClassification: restrictedFieldClassificationCeiling(baseCeiling) },
      legalEntity,
    };
  }

  const service = {
    async createEmployee(
      actor: ActorContext,
      input: CreateEmployeeInput & { initialAssignment: Omit<CreateAssignmentInput, "status"> & { status?: import("../domain/employee.ts").EmploymentStatus } },
    ): Promise<Employee> {
      if (!input.legalName?.trim()) throw new ValidationError("legalName is required.");
      if (!input.employmentCountry?.trim()) throw new ValidationError("employmentCountry is required.");
      if (!input.initialAssignment?.legalEntityId) throw new ValidationError("initialAssignment.legalEntityId is required.");
      if (!input.initialAssignment?.employmentType?.trim()) throw new ValidationError("initialAssignment.employmentType is required.");
      if (!input.initialAssignment?.startDate) throw new ValidationError("initialAssignment.startDate is required.");

      const legalEntity = await deps.organisation.findLegalEntityById(input.initialAssignment.legalEntityId);
      if (!legalEntity) throw new ValidationError("initialAssignment.legalEntityId does not refer to a known legal entity.");

      const status = input.initialAssignment.status ?? "PRE_HIRE";
      const ceiling = classificationCeilingForEntity(legalEntity);
      const access = await checkAccess(deps.rbac, actor.userId, PERMISSIONS.CREATE, PERMISSIONS.CREATE_PRIVILEGED, {
        legalEntityId: legalEntity.id,
        recordClassification: ceiling,
      });
      if (!access.allowed) throw new ForbiddenError(PERMISSIONS.CREATE);

      const seq = await deps.employees.nextEmployeeNumberSeq();

      // Employee + its required initial assignment + the status sync are
      // one atomic unit — see docs/architecture/organisation-employee-
      // master.md "Transactional employee creation". If assignment
      // creation fails (e.g. an invalid positionId/departmentId, or any
      // other constraint violation), the whole transaction rolls back and
      // no employee row is left behind — never a delete-afterward
      // compensation. Only once this resolves successfully is anything
      // audited (see below), so a rollback never gets falsely recorded as
      // a completed creation.
      const { employee, assignment } = await deps.employeeCreation.run(async (repos) => {
        const employee = await repos.employees.create({
          legalName: input.legalName,
          preferredName: input.preferredName ?? null,
          workEmail: input.workEmail ?? null,
          personalEmail: input.personalEmail ?? null,
          employmentCountry: input.employmentCountry,
          employeeNumber: formatEmployeeNumber(seq),
          createdBy: actor.userId,
        });

        const assignment = await repos.assignments.create({
          employeeId: employee.id,
          legalEntityId: input.initialAssignment.legalEntityId,
          businessUnitId: input.initialAssignment.businessUnitId ?? null,
          departmentId: input.initialAssignment.departmentId ?? null,
          positionId: input.initialAssignment.positionId ?? null,
          employmentType: input.initialAssignment.employmentType,
          status,
          isPrimary: true,
          startDate: input.initialAssignment.startDate,
          confirmationDate: input.initialAssignment.confirmationDate ?? null,
          probationEndDate: input.initialAssignment.probationEndDate ?? null,
          effectiveFrom: input.initialAssignment.effectiveFrom ?? input.initialAssignment.startDate,
          workLocation: input.initialAssignment.workLocation ?? null,
          workArrangement: input.initialAssignment.workArrangement ?? null,
          reportsToAssignmentId: input.initialAssignment.reportsToAssignmentId ?? null,
          changeReason: input.initialAssignment.changeReason ?? "Initial hire",
          createdBy: actor.userId,
        });
        const updated = await repos.employees.setStatus(employee.id, status, actor.userId);
        return { employee: updated, assignment };
      });

      await deps.audit.record({
        actorUserId: actor.userId,
        actorEmail: actor.email,
        action: "employee_master.employee.created",
        resourceType: "employee",
        resourceId: employee.id,
        legalEntityId: legalEntity.id,
        changeAfter: { employeeNumber: employee.employeeNumber, status, assignmentId: assignment.id },
        sourceIp: actor.ip,
        sourceUserAgent: actor.userAgent,
      });
      return employee;
    },

    /**
     * PR #11: resolves the CALLING actor's own linked Employee Master
     * record via the same active user_employee_links lookup getEmployee
     * already uses internally for its self-view bypass — no new
     * permission, no new access model, just one narrow path to what a
     * user can already fetch about themselves (see docs/architecture/
     * hrms-application-shell.md "API additions"). Returns null (never
     * throws) when the caller has no active Employee Master link — an
     * honest "not linked" state, not an error.
     */
    async getMyEmployee(actor: ActorContext): Promise<EmployeeView | null> {
      const selfEmployeeId = await findActiveEmployeeIdForUser(actor.userId);
      if (!selfEmployeeId) return null;
      return service.getEmployee(actor, selfEmployeeId);
    },

    async getEmployee(actor: ActorContext, id: string): Promise<EmployeeView> {
      const employee = await deps.employees.findById(id);
      if (!employee) throw new NotFoundError("Employee");
      const assignment = await deps.assignments.findCurrentPrimary(id);

      const selfEmployeeId = await findActiveEmployeeIdForUser(actor.userId);
      if (selfEmployeeId === id) {
        return { employee, currentAssignment: assignment, canReadRestricted: true };
      }

      const targets = await classificationTargetsFor(assignment);
      let baseAllowed = await checkAccess(deps.rbac, actor.userId, PERMISSIONS.READ, PERMISSIONS.READ_PRIVILEGED, targets.base);

      if (!baseAllowed.allowed && assignment) {
        const isManager = await isDirectManagerOf(actor.userId, assignment);
        if (isManager) {
          const teamCheck = await deps.rbac.authorize({ userId: actor.userId, permissionKey: PERMISSIONS.READ_TEAM });
          if (teamCheck.allowed) baseAllowed = teamCheck;
        }
      }

      if (!baseAllowed.allowed) {
        await deps.audit.record({
          actorUserId: actor.userId,
          actorEmail: actor.email,
          action: "employee_master.access.denied",
          resourceType: "employee",
          resourceId: id,
          legalEntityId: assignment?.legalEntityId ?? null,
          changeAfter: { reason: baseAllowed.reason },
          sourceIp: actor.ip,
          sourceUserAgent: actor.userAgent,
        });
        throw new NotFoundError("Employee");
      }

      const restrictedAllowed = await checkAccess(deps.rbac, actor.userId, PERMISSIONS.READ_RESTRICTED, PERMISSIONS.READ_RESTRICTED_PRIVILEGED, targets.restricted);
      if (restrictedAllowed.allowed) {
        await deps.audit.record({
          actorUserId: actor.userId,
          actorEmail: actor.email,
          action: "employee_master.employee.restricted_viewed",
          resourceType: "employee",
          resourceId: id,
          legalEntityId: assignment?.legalEntityId ?? null,
          sourceIp: actor.ip,
          sourceUserAgent: actor.userAgent,
        });
      }

      return { employee, currentAssignment: assignment, canReadRestricted: restrictedAllowed.allowed };
    },

    async listEmployees(actor: ActorContext, filter: EmployeeFilter): Promise<EmployeeView[]> {
      const candidates = await deps.employees.list(filter);
      const views: EmployeeView[] = [];
      for (const employee of candidates) {
        const assignment = await deps.assignments.findCurrentPrimary(employee.id);
        const targets = await classificationTargetsFor(assignment);
        const baseAllowed = await checkAccess(deps.rbac, actor.userId, PERMISSIONS.READ, PERMISSIONS.READ_PRIVILEGED, targets.base);
        if (!baseAllowed.allowed) continue;
        const restrictedAllowed = await checkAccess(deps.rbac, actor.userId, PERMISSIONS.READ_RESTRICTED, PERMISSIONS.READ_RESTRICTED_PRIVILEGED, targets.restricted);
        views.push({ employee, currentAssignment: assignment, canReadRestricted: restrictedAllowed.allowed });
      }
      return views;
    },

    async updateEmployee(actor: ActorContext, id: string, input: UpdateEmployeeInput): Promise<Employee> {
      const employee = await deps.employees.findById(id);
      if (!employee) throw new NotFoundError("Employee");
      const assignment = await deps.assignments.findCurrentPrimary(id);
      const targets = await classificationTargetsFor(assignment);

      const canSee = await checkAccess(deps.rbac, actor.userId, PERMISSIONS.READ, PERMISSIONS.READ_PRIVILEGED, targets.base);
      if (!canSee.allowed) throw new NotFoundError("Employee");
      const canUpdate = await checkAccess(deps.rbac, actor.userId, PERMISSIONS.UPDATE, PERMISSIONS.UPDATE_PRIVILEGED, targets.base);
      if (!canUpdate.allowed) throw new ForbiddenError(PERMISSIONS.UPDATE);

      const before = { legalName: employee.legalName, workEmail: employee.workEmail };
      const updated = await deps.employees.update(id, { ...input, updatedBy: actor.userId });
      await deps.audit.record({
        actorUserId: actor.userId,
        actorEmail: actor.email,
        action: "employee_master.employee.updated",
        resourceType: "employee",
        resourceId: id,
        legalEntityId: assignment?.legalEntityId ?? null,
        changeBefore: before,
        changeAfter: { legalName: updated.legalName, workEmail: updated.workEmail },
        sourceIp: actor.ip,
        sourceUserAgent: actor.userAgent,
      });
      return updated;
    },

    async linkIdentity(actor: ActorContext, employeeId: string, targetUserId: string): Promise<void> {
      const employee = await deps.employees.findById(employeeId);
      if (!employee) throw new NotFoundError("Employee");
      const assignment = await deps.assignments.findCurrentPrimary(employeeId);
      const targets = await classificationTargetsFor(assignment);

      const access = await checkAccess(deps.rbac, actor.userId, PERMISSIONS.LINK_IDENTITY, PERMISSIONS.LINK_IDENTITY_PRIVILEGED, targets.base);
      if (!access.allowed) throw new ForbiddenError(PERMISSIONS.LINK_IDENTITY);

      const existingForUser = await deps.users.findActiveLinkByUserId(targetUserId);
      if (existingForUser) throw new ValidationError("This user account is already linked to an employee.");
      const existingForEmployee = await deps.users.findActiveLinkByEmployeeId(employeeId);
      if (existingForEmployee) throw new ValidationError("This employee already has a linked user account.");

      const targetUser = await deps.users.findById(targetUserId);
      if (!targetUser) throw new ValidationError("userId does not refer to a known Identity user.");

      await deps.users.linkEmployee({ userId: targetUserId, employeeId, linkedBy: actor.userId });
      await deps.audit.record({
        actorUserId: actor.userId,
        actorEmail: actor.email,
        action: "employee_master.identity.linked",
        resourceType: "employee",
        resourceId: employeeId,
        legalEntityId: assignment?.legalEntityId ?? null,
        changeAfter: { userId: targetUserId },
        sourceIp: actor.ip,
        sourceUserAgent: actor.userAgent,
      });
    },

    async unlinkIdentity(actor: ActorContext, employeeId: string): Promise<void> {
      const employee = await deps.employees.findById(employeeId);
      if (!employee) throw new NotFoundError("Employee");
      const assignment = await deps.assignments.findCurrentPrimary(employeeId);
      const targets = await classificationTargetsFor(assignment);

      const access = await checkAccess(deps.rbac, actor.userId, PERMISSIONS.LINK_IDENTITY, PERMISSIONS.LINK_IDENTITY_PRIVILEGED, targets.base);
      if (!access.allowed) throw new ForbiddenError(PERMISSIONS.LINK_IDENTITY);

      const existing = await deps.users.findActiveLinkByEmployeeId(employeeId);
      if (!existing) throw new ValidationError("This employee has no active linked user account.");

      await deps.users.unlinkEmployee(existing.id, actor.userId);
      await deps.audit.record({
        actorUserId: actor.userId,
        actorEmail: actor.email,
        action: "employee_master.identity.unlinked",
        resourceType: "employee",
        resourceId: employeeId,
        legalEntityId: assignment?.legalEntityId ?? null,
        changeAfter: { userId: existing.userId },
        sourceIp: actor.ip,
        sourceUserAgent: actor.userAgent,
      });
    },
  };
  return service;
}

export type EmployeeService = ReturnType<typeof createEmployeeService>;
