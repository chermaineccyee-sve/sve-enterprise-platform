/**
 * Employment Assignment transitions — the effective-dated history engine
 * behind Employee Master. A transition (transfer/promotion/department or
 * manager change/status change) never overwrites the current assignment
 * row's business fields: it closes the current row (sets effective_to)
 * and inserts a new one. See docs/architecture/organisation-employee-
 * master.md "Effective-dated records".
 */
import type { EmployeeRepository, EmploymentAssignmentRepository, OrgStructureRepository, EmploymentAssignmentTransaction } from "../repositories/types.ts";
import type { RbacService } from "../../../identity/src/services/rbacService.ts";
import type { AuditService } from "../../../identity/src/services/auditService.ts";
import type { OrganisationRepository, UserRepository } from "../../../identity/src/repositories/types.ts";
import { ForbiddenError } from "../../../identity/src/domain/errors.ts";
import { NotFoundError, ValidationError } from "../domain/errors.ts";
import type { EmploymentAssignment, CreateAssignmentInput, AssignmentFilter } from "../domain/employee.ts";
import { classificationCeilingForEntity } from "./entityClassification.ts";
import { PERMISSIONS } from "./employeeService.ts";
import type { DataClassification } from "../../../../packages/types/src/entity-context.ts";

interface ActorContext {
  userId: string;
  email: string;
  ip?: string | null;
  userAgent?: string | null;
}

const MAX_REPORTING_CHAIN_DEPTH = 50;

async function checkAccess(rbac: RbacService, userId: string, baseKey: string, privilegedKey: string, target: { legalEntityId?: string; recordClassification?: DataClassification }) {
  const base = await rbac.authorize({ userId, permissionKey: baseKey, target });
  if (base.allowed) return base;
  return rbac.authorize({ userId, permissionKey: privilegedKey, target });
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function createEmploymentAssignmentService(deps: {
  employees: EmployeeRepository;
  assignments: EmploymentAssignmentRepository;
  orgStructure: OrgStructureRepository;
  organisation: OrganisationRepository;
  users: UserRepository;
  rbac: RbacService;
  audit: AuditService;
  transactions: EmploymentAssignmentTransaction;
}) {
  /**
   * Walks the reports-to-assignment chain starting at `startAssignmentId`,
   * bounded to MAX_REPORTING_CHAIN_DEPTH hops, and returns true if
   * `employeeId` is ever encountered — i.e. the employee would end up
   * (directly or transitively) reporting to themselves. Rejects both
   * self-reporting (immediate parent = self) and multi-hop cycles.
   *
   * Takes `assignments` as a parameter (rather than closing over `deps.
   * assignments`) so a reporting-edge-introducing call can run this check
   * against the SAME lock-held transaction connection used for the
   * subsequent write — see EmploymentAssignmentTransaction and docs/
   * architecture/organisation-employee-master.md "Reporting-cycle
   * concurrency safety" for why that matters.
   */
  async function reportingChainReachesEmployee(assignments: EmploymentAssignmentRepository, startAssignmentId: string, employeeId: string): Promise<boolean> {
    let currentId: string | null = startAssignmentId;
    for (let hop = 0; hop < MAX_REPORTING_CHAIN_DEPTH && currentId; hop++) {
      const current: EmploymentAssignment | null = await assignments.findById(currentId);
      if (!current) return false;
      if (current.employeeId === employeeId) return true;
      currentId = current.reportsToAssignmentId;
    }
    return false;
  }

  /**
   * Is `manager` live (open/current) at `atEffectiveDate` — the date the
   * NEW reporting edge itself takes effect? Deliberately date-range
   * containment (`effectiveFrom <= atEffectiveDate <= effectiveTo-or-open`)
   * rather than a `NOW()`/wall-clock check, so a future-dated transition
   * (e.g. a promotion effective next quarter) is validated against ITS OWN
   * effective date, not today's — see docs/architecture/organisation-
   * employee-master.md "Current manager assignment integrity". A row whose
   * effective range does not cover that date — including any already-
   * closed (historical) row — fails this check; this establishes only
   * whether a NEW live edge may be created against `manager`, and never
   * alters `manager`'s own stored fields (historical rows are never
   * rewritten).
   */
  function isCurrentAt(manager: EmploymentAssignment, atEffectiveDate: string): boolean {
    if (manager.effectiveFrom > atEffectiveDate) return false;
    if (manager.effectiveTo !== null && manager.effectiveTo < atEffectiveDate) return false;
    return true;
  }

  return {
    /** Creates a new effective-dated assignment — a hire (no prior primary) or a transition (closes the prior primary first). */
    async createAssignment(actor: ActorContext, employeeId: string, input: CreateAssignmentInput): Promise<EmploymentAssignment> {
      const employee = await deps.employees.findById(employeeId);
      if (!employee) throw new NotFoundError("Employee");
      if (!input.legalEntityId) throw new ValidationError("legalEntityId is required.");
      if (!input.employmentType?.trim()) throw new ValidationError("employmentType is required.");
      if (!input.startDate) throw new ValidationError("startDate is required.");
      if (!input.effectiveFrom) throw new ValidationError("effectiveFrom is required.");

      const legalEntity = await deps.organisation.findLegalEntityById(input.legalEntityId);
      if (!legalEntity) throw new ValidationError("legalEntityId does not refer to a known legal entity.");
      const ceiling = classificationCeilingForEntity(legalEntity);

      const existingPrimary = input.isPrimary === false ? null : await deps.assignments.findCurrentPrimary(employeeId);
      // Authorize against BOTH the current entity (if transitioning an existing
      // primary assignment) and the new one, so a transfer requires authority
      // over the destination entity, not only the origin.
      const currentCeiling = existingPrimary
        ? classificationCeilingForEntity((await deps.organisation.findLegalEntityById(existingPrimary.legalEntityId)) ?? legalEntity)
        : ceiling;
      const currentAccess = await checkAccess(deps.rbac, actor.userId, PERMISSIONS.MANAGE_ASSIGNMENT, PERMISSIONS.MANAGE_ASSIGNMENT_PRIVILEGED, {
        legalEntityId: existingPrimary?.legalEntityId ?? legalEntity.id,
        recordClassification: currentCeiling,
      });
      if (!currentAccess.allowed) throw new ForbiddenError(PERMISSIONS.MANAGE_ASSIGNMENT);
      const newAccess = await checkAccess(deps.rbac, actor.userId, PERMISSIONS.MANAGE_ASSIGNMENT, PERMISSIONS.MANAGE_ASSIGNMENT_PRIVILEGED, {
        legalEntityId: legalEntity.id,
        recordClassification: ceiling,
      });
      if (!newAccess.allowed) throw new ForbiddenError(PERMISSIONS.MANAGE_ASSIGNMENT);

      if (input.reportsToAssignmentId) {
        // Note: reporting to one's own about-to-be-superseded assignment is
        // caught below too (reportsTo.employeeId === employeeId), since
        // existingPrimary.employeeId is always this same employeeId.
        const manageReporting = await checkAccess(deps.rbac, actor.userId, PERMISSIONS.MANAGE_REPORTING, PERMISSIONS.MANAGE_REPORTING_PRIVILEGED, {
          legalEntityId: legalEntity.id,
          recordClassification: ceiling,
        });
        if (!manageReporting.allowed) throw new ForbiddenError(PERMISSIONS.MANAGE_REPORTING);
      }

      // The cycle check + close-existing + insert-new happen inside one
      // transaction. Only when input.reportsToAssignmentId is set (a new
      // reporting edge is being introduced) is the transaction-scoped
      // advisory lock also taken first, serializing this against every
      // other concurrent edge-introducing call — see
      // EmploymentAssignmentTransaction and docs/architecture/
      // organisation-employee-master.md "Reporting-cycle concurrency
      // safety". Re-reading reportsTo/existingPrimary here (rather than
      // reusing the pre-lock `existingPrimary` above) means a caller that
      // was blocked on the lock sees the graph exactly as it stands after
      // every earlier-queued edge-introducing call has committed.
      const created = await deps.transactions.run({ lock: Boolean(input.reportsToAssignmentId) }, async ({ assignments: txAssignments }) => {
        if (input.reportsToAssignmentId) {
          const reportsTo = await txAssignments.findById(input.reportsToAssignmentId);
          // A nonexistent id and a real-but-historical (closed, or not yet
          // effective) one are rejected with the SAME message — same
          // IDOR-safe principle used for employee records elsewhere in
          // this package: the caller must not be able to distinguish "no
          // such assignment" from "that assignment exists but is no
          // longer (or not yet) current" for an id they don't otherwise
          // have visibility into.
          if (!reportsTo || !isCurrentAt(reportsTo, input.effectiveFrom ?? input.startDate)) {
            throw new ValidationError("reportsToAssignmentId does not refer to a current employment assignment.");
          }
          if (reportsTo.employeeId === employeeId) throw new ValidationError("An employee cannot report to their own assignment (self-reporting).");
          const cycle = await reportingChainReachesEmployee(txAssignments, input.reportsToAssignmentId, employeeId);
          if (cycle) throw new ValidationError("This reporting assignment would create a circular reporting relationship.");
        }

        const currentPrimary = input.isPrimary === false ? null : await txAssignments.findCurrentPrimary(employeeId);
        if (currentPrimary) {
          await txAssignments.closeAssignment(currentPrimary.id, { effectiveTo: addDays(input.effectiveFrom ?? input.startDate, -1), updatedBy: actor.userId });
        }
        return txAssignments.create({ ...input, effectiveFrom: input.effectiveFrom ?? input.startDate, employeeId, createdBy: actor.userId });
      });
      await deps.employees.setStatus(employeeId, input.status, actor.userId);

      const changeType = !existingPrimary
        ? "hire"
        : existingPrimary.legalEntityId !== input.legalEntityId
          ? "entity_transfer"
          : existingPrimary.departmentId !== (input.departmentId ?? null)
            ? "department_transfer"
            : existingPrimary.positionId !== (input.positionId ?? null)
              ? "position_change"
              : existingPrimary.status !== input.status
                ? "status_change"
                : existingPrimary.reportsToAssignmentId !== (input.reportsToAssignmentId ?? null)
                  ? "reporting_change"
                  : "update";

      await deps.audit.record({
        actorUserId: actor.userId,
        actorEmail: actor.email,
        action: "employee_master.assignment.created",
        resourceType: "employment_assignment",
        resourceId: created.id,
        legalEntityId: legalEntity.id,
        changeBefore: existingPrimary
          ? { legalEntityId: existingPrimary.legalEntityId, departmentId: existingPrimary.departmentId, positionId: existingPrimary.positionId, status: existingPrimary.status }
          : undefined,
        changeAfter: { changeType, legalEntityId: created.legalEntityId, departmentId: created.departmentId, positionId: created.positionId, status: created.status },
        sourceIp: actor.ip,
        sourceUserAgent: actor.userAgent,
      });
      return created;
    },

    /** Terminal end of employment — closes the current primary assignment with no successor row. */
    async endAssignment(actor: ActorContext, employeeId: string, input: { endDate: string; status: "TERMINATED" | "RESIGNED"; changeReason?: string }): Promise<EmploymentAssignment> {
      const employee = await deps.employees.findById(employeeId);
      if (!employee) throw new NotFoundError("Employee");
      const current = await deps.assignments.findCurrentPrimary(employeeId);
      if (!current) throw new ValidationError("Employee has no current primary assignment to end.");

      const legalEntity = await deps.organisation.findLegalEntityById(current.legalEntityId);
      const ceiling = legalEntity ? classificationCeilingForEntity(legalEntity) : "INTERNAL";
      const access = await checkAccess(deps.rbac, actor.userId, PERMISSIONS.MANAGE_ASSIGNMENT, PERMISSIONS.MANAGE_ASSIGNMENT_PRIVILEGED, {
        legalEntityId: current.legalEntityId,
        recordClassification: ceiling,
      });
      if (!access.allowed) throw new ForbiddenError(PERMISSIONS.MANAGE_ASSIGNMENT);

      const closed = await deps.assignments.closeAssignment(current.id, { effectiveTo: input.endDate, endDate: input.endDate, status: input.status, updatedBy: actor.userId });
      await deps.employees.setStatus(employeeId, input.status, actor.userId);

      await deps.audit.record({
        actorUserId: actor.userId,
        actorEmail: actor.email,
        action: "employee_master.assignment.ended",
        resourceType: "employment_assignment",
        resourceId: closed.id,
        legalEntityId: current.legalEntityId,
        changeBefore: { status: current.status },
        changeAfter: { status: input.status, endDate: input.endDate, reason: input.changeReason ?? null },
        sourceIp: actor.ip,
        sourceUserAgent: actor.userAgent,
      });
      return closed;
    },

    async listAssignments(actor: ActorContext, employeeId: string): Promise<EmploymentAssignment[]> {
      const employee = await deps.employees.findById(employeeId);
      if (!employee) throw new NotFoundError("Employee");
      const current = await deps.assignments.findCurrentPrimary(employeeId);
      const legalEntity = current ? await deps.organisation.findLegalEntityById(current.legalEntityId) : null;
      const ceiling = legalEntity ? classificationCeilingForEntity(legalEntity) : "INTERNAL";
      const access = await checkAccess(deps.rbac, actor.userId, PERMISSIONS.READ_RESTRICTED, PERMISSIONS.READ_RESTRICTED_PRIVILEGED, {
        legalEntityId: current?.legalEntityId,
        recordClassification: ceiling,
      });
      if (!access.allowed) throw new NotFoundError("Employee");
      return deps.assignments.list({ employeeId } satisfies AssignmentFilter);
    },

    /**
     * Is `actorUserId` (via their own linked employee record) the direct
     * manager of `employeeId`'s current primary assignment — the same
     * reporting-line check `employeeService.getEmployee()`'s manager/"team"
     * fallback already performs internally, exposed here as a small,
     * read-only, side-effect-free capability so OTHER packages (e.g.
     * platform-services/hrms's own read.team fallback for lifecycle cases)
     * can reuse this package's authoritative reporting-line data without
     * duplicating it. Returns a plain boolean — never assignment/position
     * data — so it carries no classification concerns of its own; the
     * caller still runs its own permission checks around the result.
     */
    async isDirectManagerOf(actorUserId: string, employeeId: string): Promise<boolean> {
      const targetAssignment = await deps.assignments.findCurrentPrimary(employeeId);
      if (!targetAssignment) return false;
      const actorLink = await deps.users.findActiveLinkByUserId(actorUserId);
      if (!actorLink) return false;
      const actorAssignment = await deps.assignments.findCurrentPrimary(actorLink.employeeId);
      if (!actorAssignment) return false;
      if (targetAssignment.reportsToAssignmentId === actorAssignment.id) return true;
      if (targetAssignment.positionId) {
        const position = await deps.orgStructure.findPositionById(targetAssignment.positionId);
        if (position?.reportsToPositionId && actorAssignment.positionId && position.reportsToPositionId === actorAssignment.positionId) return true;
      }
      return false;
    },

    /**
     * The Identity userId of `employeeId`'s current direct manager (via the
     * SAME reporting-line resolution isDirectManagerOf walks — the
     * assignment-level reportsToAssignmentId edge, falling back to the
     * position-level reportsToPositionId edge), or null if none can be
     * resolved (no current assignment, no manager assignment, or the
     * manager has no active linked Identity user). Read-only, side-effect-
     * free — exposed so other packages (e.g. platform-services/workflow's
     * MANAGER routing/escalation, PR #8) can resolve a concrete approver
     * identity without duplicating this package's authoritative
     * reporting-line data. Returns an opaque userId, never assignment or
     * position data, so it carries no classification concerns of its own;
     * the caller still runs its own permission checks around the result.
     */
    async resolveDirectManagerUserId(employeeId: string): Promise<string | null> {
      const targetAssignment = await deps.assignments.findCurrentPrimary(employeeId);
      if (!targetAssignment) return null;

      let managerAssignment: EmploymentAssignment | null = null;
      if (targetAssignment.reportsToAssignmentId) {
        managerAssignment = await deps.assignments.findById(targetAssignment.reportsToAssignmentId);
      } else if (targetAssignment.positionId) {
        const position = await deps.orgStructure.findPositionById(targetAssignment.positionId);
        if (position?.reportsToPositionId) {
          const holders = await deps.assignments.findByPositionId(position.reportsToPositionId, true);
          managerAssignment = holders[0] ?? null;
        }
      }
      if (!managerAssignment) return null;

      const managerLink = await deps.users.findActiveLinkByEmployeeId(managerAssignment.employeeId);
      return managerLink?.userId ?? null;
    },
  };
}

export type EmploymentAssignmentService = ReturnType<typeof createEmploymentAssignmentService>;
