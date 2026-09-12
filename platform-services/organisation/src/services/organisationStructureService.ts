/**
 * Organisation structure service — business units, departments, positions.
 * Lower sensitivity than Employee Master (structural directory data, not
 * personal/employment facts), so reads only require authentication
 * (mirroring platform-services/data-vault's legal-entities reference
 * route); writes require an entity-scoped `organisation.manage`
 * permission with the same ordinary/.privileged tiering used everywhere
 * else in this package, so SK Lai & Partners' own structure still can't
 * be created/edited by a non-privileged Group administrator.
 */
import type { OrgStructureRepository } from "../repositories/types.ts";
import type { RbacService } from "../../../identity/src/services/rbacService.ts";
import type { AuditService } from "../../../identity/src/services/auditService.ts";
import type { OrganisationRepository } from "../../../identity/src/repositories/types.ts";
import { ForbiddenError } from "../../../identity/src/domain/errors.ts";
import { ValidationError } from "../domain/errors.ts";
import type { BusinessUnit, Department, Position, CreateBusinessUnitInput, CreateDepartmentInput, CreatePositionInput } from "../domain/organisation.ts";
import { classificationCeilingForEntity } from "./entityClassification.ts";

export const ORG_PERMISSIONS = {
  MANAGE: "organisation.manage",
  MANAGE_PRIVILEGED: "organisation.manage.privileged",
} as const;

interface ActorContext {
  userId: string;
  email: string;
  ip?: string | null;
  userAgent?: string | null;
}

export function createOrganisationStructureService(deps: {
  orgStructure: OrgStructureRepository;
  organisation: OrganisationRepository;
  rbac: RbacService;
  audit: AuditService;
}) {
  async function requireManageAccess(actor: ActorContext, legalEntityId: string) {
    const legalEntity = await deps.organisation.findLegalEntityById(legalEntityId);
    if (!legalEntity) throw new ValidationError("legalEntityId does not refer to a known legal entity.");
    const ceiling = classificationCeilingForEntity(legalEntity);
    const base = await deps.rbac.authorize({ userId: actor.userId, permissionKey: ORG_PERMISSIONS.MANAGE, target: { legalEntityId, recordClassification: ceiling } });
    const allowed = base.allowed
      ? base
      : await deps.rbac.authorize({ userId: actor.userId, permissionKey: ORG_PERMISSIONS.MANAGE_PRIVILEGED, target: { legalEntityId, recordClassification: ceiling } });
    if (!allowed.allowed) throw new ForbiddenError(ORG_PERMISSIONS.MANAGE);
    return legalEntity;
  }

  return {
    async listBusinessUnits(filter?: { legalEntityId?: string }): Promise<BusinessUnit[]> {
      return deps.orgStructure.listBusinessUnits(filter);
    },
    async listDepartments(filter?: { legalEntityId?: string; businessUnitId?: string }): Promise<Department[]> {
      return deps.orgStructure.listDepartments(filter);
    },
    async listPositions(filter?: { departmentId?: string }): Promise<Position[]> {
      return deps.orgStructure.listPositions(filter);
    },

    async createBusinessUnit(actor: ActorContext, input: CreateBusinessUnitInput): Promise<BusinessUnit> {
      if (!input.name?.trim() || !input.code?.trim()) throw new ValidationError("name and code are required.");
      await requireManageAccess(actor, input.legalEntityId);
      const unit = await deps.orgStructure.createBusinessUnit(input);
      await deps.audit.record({
        actorUserId: actor.userId,
        actorEmail: actor.email,
        action: "organisation.business_unit.created",
        resourceType: "business_unit",
        resourceId: unit.id,
        legalEntityId: unit.legalEntityId,
        changeAfter: { name: unit.name, code: unit.code },
        sourceIp: actor.ip,
        sourceUserAgent: actor.userAgent,
      });
      return unit;
    },

    async createDepartment(actor: ActorContext, input: CreateDepartmentInput): Promise<Department> {
      if (!input.name?.trim() || !input.code?.trim()) throw new ValidationError("name and code are required.");
      await requireManageAccess(actor, input.legalEntityId);
      if (input.businessUnitId) {
        const unit = await deps.orgStructure.findBusinessUnitById(input.businessUnitId);
        if (!unit) throw new ValidationError("businessUnitId does not refer to a known business unit.");
        if (unit.legalEntityId !== input.legalEntityId) throw new ValidationError("businessUnitId does not belong to the given legalEntityId.");
      }
      const department = await deps.orgStructure.createDepartment(input);
      await deps.audit.record({
        actorUserId: actor.userId,
        actorEmail: actor.email,
        action: "organisation.department.created",
        resourceType: "department",
        resourceId: department.id,
        legalEntityId: department.legalEntityId,
        changeAfter: { name: department.name, code: department.code },
        sourceIp: actor.ip,
        sourceUserAgent: actor.userAgent,
      });
      return department;
    },

    async createPosition(actor: ActorContext, input: CreatePositionInput): Promise<Position> {
      if (!input.title?.trim()) throw new ValidationError("title is required.");
      const department = await deps.orgStructure.findDepartmentById(input.departmentId);
      if (!department) throw new ValidationError("departmentId does not refer to a known department.");
      await requireManageAccess(actor, department.legalEntityId);
      if (input.reportsToPositionId) {
        const target = await deps.orgStructure.findPositionById(input.reportsToPositionId);
        if (!target) throw new ValidationError("reportsToPositionId does not refer to a known position.");
      }
      const position = await deps.orgStructure.createPosition(input);
      await deps.audit.record({
        actorUserId: actor.userId,
        actorEmail: actor.email,
        action: "organisation.position.created",
        resourceType: "position",
        resourceId: position.id,
        legalEntityId: department.legalEntityId,
        changeAfter: { title: position.title, departmentId: position.departmentId },
        sourceIp: actor.ip,
        sourceUserAgent: actor.userAgent,
      });
      return position;
    },
  };
}

export type OrganisationStructureService = ReturnType<typeof createOrganisationStructureService>;
