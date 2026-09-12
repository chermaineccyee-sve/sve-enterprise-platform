/**
 * A fresh, isolated in-memory store per test — exercises real repository
 * logic (not mocks of the services under test), just without a live
 * Postgres. See test/integration/*.postgres.test.ts for the same
 * repository *interface* exercised against real Postgres.
 */
import { randomUUID } from "node:crypto";
import type {
  User,
  UserEmployeeLink,
  LegalEntity,
  Group,
  Role,
  Permission,
  UserRoleAssignment,
  EntityAccessGrant,
  Session,
  MfaMethod,
  MfaRecoveryCode,
  AuthenticationAttempt,
  SecurityAuditEvent,
} from "../../domain/entities.ts";
import type { PasswordHash } from "../../crypto/password.ts";

export interface InMemoryStore {
  groups: Group[];
  legalEntities: LegalEntity[];
  users: User[];
  credentials: Map<string, PasswordHash>;
  employeeLinks: UserEmployeeLink[];
  roles: Role[];
  permissions: Permission[];
  rolePermissions: { roleId: string; permissionId: string }[];
  roleAssignments: UserRoleAssignment[];
  entityAccessGrants: EntityAccessGrant[];
  sessions: Session[];
  mfaMethods: MfaMethod[];
  recoveryCodes: MfaRecoveryCode[];
  attempts: AuthenticationAttempt[];
  auditEvents: SecurityAuditEvent[];
}

export function createInMemoryStore(): InMemoryStore {
  const sveGroup: Group = { id: randomUUID(), key: "sve-group", name: "SVE Group" };
  const legalEntities: LegalEntity[] = [
    {
      id: randomUUID(),
      groupId: sveGroup.id,
      key: "sve-international-sg",
      name: "SVE International Pte. Ltd.",
      jurisdiction: "SG",
      currency: "SGD",
      isGroupHeadquarters: true,
    },
    {
      id: randomUUID(),
      groupId: sveGroup.id,
      key: "sve-international-my",
      name: "SVE International Sdn. Bhd.",
      jurisdiction: "MY",
      currency: "MYR",
      isGroupHeadquarters: false,
    },
    {
      id: randomUUID(),
      groupId: sveGroup.id,
      key: "sk-lai-partners-my",
      name: "SK Lai & Partners",
      jurisdiction: "MY",
      currency: "MYR",
      isGroupHeadquarters: false,
    },
  ];
  return {
    groups: [sveGroup],
    legalEntities,
    users: [],
    credentials: new Map(),
    employeeLinks: [],
    roles: [],
    permissions: [],
    rolePermissions: [],
    roleAssignments: [],
    entityAccessGrants: [],
    sessions: [],
    mfaMethods: [],
    recoveryCodes: [],
    attempts: [],
    auditEvents: [],
  };
}
