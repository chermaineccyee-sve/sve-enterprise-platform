import { randomUUID } from "node:crypto";
import type { RbacRepository } from "../types.ts";
import type { InMemoryStore } from "./inMemoryStore.ts";
import type { EntityAccessScopeType, Permission, Role, UserRoleAssignment, EntityAccessGrant } from "../../domain/entities.ts";

export function createInMemoryRbacRepository(store: InMemoryStore): RbacRepository {
  return {
    async createRole(input): Promise<Role> {
      const role: Role = { id: randomUUID(), key: input.key, name: input.name, description: input.description ?? null };
      store.roles.push(role);
      return role;
    },
    async findRoleByKey(key: string): Promise<Role | null> {
      return store.roles.find((r) => r.key === key) ?? null;
    },
    async createPermission(input): Promise<Permission> {
      const permission: Permission = {
        id: randomUUID(),
        key: input.key,
        description: input.description ?? null,
        maxClassification: input.maxClassification,
      };
      store.permissions.push(permission);
      return permission;
    },
    async findPermissionByKey(key: string): Promise<Permission | null> {
      return store.permissions.find((p) => p.key === key) ?? null;
    },
    async grantPermissionToRole(roleId: string, permissionId: string): Promise<void> {
      store.rolePermissions.push({ roleId, permissionId });
    },
    async assignRole(input): Promise<UserRoleAssignment> {
      const assignment: UserRoleAssignment = {
        id: randomUUID(),
        userId: input.userId,
        roleId: input.roleId,
        grantedBy: input.grantedBy,
        grantedAt: new Date().toISOString(),
        revokedAt: null,
        revokedBy: null,
      };
      store.roleAssignments.push(assignment);
      return assignment;
    },
    async revokeRoleAssignment(assignmentId: string, revokedBy: string): Promise<void> {
      const assignment = store.roleAssignments.find((a) => a.id === assignmentId);
      if (assignment) {
        assignment.revokedAt = new Date().toISOString();
        assignment.revokedBy = revokedBy;
      }
    },
    async listActiveRoleAssignments(userId: string): Promise<UserRoleAssignment[]> {
      return store.roleAssignments.filter((a) => a.userId === userId && a.revokedAt === null);
    },
    async listPermissionsForRole(roleId: string): Promise<Permission[]> {
      const permissionIds = store.rolePermissions.filter((rp) => rp.roleId === roleId).map((rp) => rp.permissionId);
      return store.permissions.filter((p) => permissionIds.includes(p.id));
    },
    async grantEntityAccess(input: {
      userId: string;
      scopeType: EntityAccessScopeType;
      legalEntityId?: string | null;
      businessUnitId?: string | null;
      departmentId?: string | null;
      grantedBy: string;
    }): Promise<EntityAccessGrant> {
      const grant: EntityAccessGrant = {
        id: randomUUID(),
        userId: input.userId,
        scopeType: input.scopeType,
        legalEntityId: input.legalEntityId ?? null,
        businessUnitId: input.businessUnitId ?? null,
        departmentId: input.departmentId ?? null,
        grantedBy: input.grantedBy,
        grantedAt: new Date().toISOString(),
        revokedAt: null,
        revokedBy: null,
      };
      store.entityAccessGrants.push(grant);
      return grant;
    },
    async revokeEntityAccess(grantId: string, revokedBy: string): Promise<void> {
      const grant = store.entityAccessGrants.find((g) => g.id === grantId);
      if (grant) {
        grant.revokedAt = new Date().toISOString();
        grant.revokedBy = revokedBy;
      }
    },
    async listActiveEntityAccessGrants(userId: string): Promise<EntityAccessGrant[]> {
      return store.entityAccessGrants.filter((g) => g.userId === userId && g.revokedAt === null);
    },
  };
}
