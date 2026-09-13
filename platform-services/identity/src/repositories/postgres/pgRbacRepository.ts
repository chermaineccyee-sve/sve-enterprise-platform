import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { RbacRepository } from "../types.ts";
import type {
  EntityAccessGrant,
  EntityAccessScopeType,
  Permission,
  Role,
  UserRoleAssignment,
} from "../../domain/entities.ts";
import type { DataClassification } from "../../../../../packages/types/src/entity-context.ts";

interface RoleRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
}
interface PermissionRow {
  id: string;
  key: string;
  description: string | null;
  max_classification: DataClassification;
}
interface AssignmentRow {
  id: string;
  user_id: string;
  role_id: string;
  granted_by: string;
  granted_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
}
interface GrantRow {
  id: string;
  user_id: string;
  scope_type: EntityAccessScopeType;
  legal_entity_id: string | null;
  business_unit_id: string | null;
  department_id: string | null;
  granted_by: string;
  granted_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
}

const mapRole = (r: RoleRow): Role => ({ id: r.id, key: r.key, name: r.name, description: r.description });
const mapPermission = (r: PermissionRow): Permission => ({
  id: r.id,
  key: r.key,
  description: r.description,
  maxClassification: r.max_classification,
});
const mapAssignment = (r: AssignmentRow): UserRoleAssignment => ({
  id: r.id,
  userId: r.user_id,
  roleId: r.role_id,
  grantedBy: r.granted_by,
  grantedAt: r.granted_at,
  revokedAt: r.revoked_at,
  revokedBy: r.revoked_by,
});
const mapGrant = (r: GrantRow): EntityAccessGrant => ({
  id: r.id,
  userId: r.user_id,
  scopeType: r.scope_type,
  legalEntityId: r.legal_entity_id,
  businessUnitId: r.business_unit_id,
  departmentId: r.department_id,
  grantedBy: r.granted_by,
  grantedAt: r.granted_at,
  revokedAt: r.revoked_at,
  revokedBy: r.revoked_by,
});

export function createPgRbacRepository(db: DatabaseProvider): RbacRepository {
  return {
    async createRole(input): Promise<Role> {
      const result = await db.query<RoleRow>(
        `INSERT INTO roles(key, name, description) VALUES ($1, $2, $3) RETURNING id, key, name, description`,
        [input.key, input.name, input.description ?? null],
      );
      return mapRole(result.rows[0]!);
    },
    async findRoleByKey(key: string): Promise<Role | null> {
      const result = await db.query<RoleRow>(`SELECT id, key, name, description FROM roles WHERE key = $1`, [key]);
      return result.rows[0] ? mapRole(result.rows[0]) : null;
    },
    async createPermission(input): Promise<Permission> {
      const result = await db.query<PermissionRow>(
        `INSERT INTO permissions(key, description, max_classification) VALUES ($1, $2, $3)
         RETURNING id, key, description, max_classification`,
        [input.key, input.description ?? null, input.maxClassification],
      );
      return mapPermission(result.rows[0]!);
    },
    async findPermissionByKey(key: string): Promise<Permission | null> {
      const result = await db.query<PermissionRow>(
        `SELECT id, key, description, max_classification FROM permissions WHERE key = $1`,
        [key],
      );
      return result.rows[0] ? mapPermission(result.rows[0]) : null;
    },
    async grantPermissionToRole(roleId: string, permissionId: string): Promise<void> {
      await db.query(
        `INSERT INTO role_permissions(role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [roleId, permissionId],
      );
    },
    async assignRole(input): Promise<UserRoleAssignment> {
      const result = await db.query<AssignmentRow>(
        `INSERT INTO user_role_assignments(user_id, role_id, granted_by) VALUES ($1, $2, $3)
         RETURNING id, user_id, role_id, granted_by, granted_at, revoked_at, revoked_by`,
        [input.userId, input.roleId, input.grantedBy],
      );
      return mapAssignment(result.rows[0]!);
    },
    async revokeRoleAssignment(assignmentId: string, revokedBy: string): Promise<void> {
      await db.query(
        `UPDATE user_role_assignments SET revoked_at = NOW(), revoked_by = $2 WHERE id = $1 AND revoked_at IS NULL`,
        [assignmentId, revokedBy],
      );
    },
    async listActiveRoleAssignments(userId: string): Promise<UserRoleAssignment[]> {
      const result = await db.query<AssignmentRow>(
        `SELECT id, user_id, role_id, granted_by, granted_at, revoked_at, revoked_by
         FROM user_role_assignments WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId],
      );
      return result.rows.map(mapAssignment);
    },
    async listPermissionsForRole(roleId: string): Promise<Permission[]> {
      const result = await db.query<PermissionRow>(
        `SELECT p.id, p.key, p.description, p.max_classification
         FROM permissions p
         JOIN role_permissions rp ON rp.permission_id = p.id
         WHERE rp.role_id = $1`,
        [roleId],
      );
      return result.rows.map(mapPermission);
    },
    async grantEntityAccess(input): Promise<EntityAccessGrant> {
      const result = await db.query<GrantRow>(
        `INSERT INTO entity_access_grants(user_id, scope_type, legal_entity_id, business_unit_id, department_id, granted_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, user_id, scope_type, legal_entity_id, business_unit_id, department_id, granted_by, granted_at, revoked_at, revoked_by`,
        [
          input.userId,
          input.scopeType,
          input.legalEntityId ?? null,
          input.businessUnitId ?? null,
          input.departmentId ?? null,
          input.grantedBy,
        ],
      );
      return mapGrant(result.rows[0]!);
    },
    async revokeEntityAccess(grantId: string, revokedBy: string): Promise<void> {
      await db.query(
        `UPDATE entity_access_grants SET revoked_at = NOW(), revoked_by = $2 WHERE id = $1 AND revoked_at IS NULL`,
        [grantId, revokedBy],
      );
    },
    async listActiveEntityAccessGrants(userId: string): Promise<EntityAccessGrant[]> {
      const result = await db.query<GrantRow>(
        `SELECT id, user_id, scope_type, legal_entity_id, business_unit_id, department_id, granted_by, granted_at, revoked_at, revoked_by
         FROM entity_access_grants WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId],
      );
      return result.rows.map(mapGrant);
    },
    async listActiveUserIdsForPermission(permissionKey: string): Promise<string[]> {
      const result = await db.query<{ user_id: string }>(
        `SELECT DISTINCT ura.user_id
         FROM user_role_assignments ura
         JOIN role_permissions rp ON rp.role_id = ura.role_id
         JOIN permissions p ON p.id = rp.permission_id
         WHERE p.key = $1 AND ura.revoked_at IS NULL`,
        [permissionKey],
      );
      return result.rows.map((r) => r.user_id);
    },
  };
}
