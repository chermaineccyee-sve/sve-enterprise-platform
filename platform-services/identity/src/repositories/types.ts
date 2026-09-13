/**
 * Repository interfaces. Services (src/services/*) depend on these, never
 * on a concrete DatabaseProvider/SQL client directly — this is what lets
 * tests substitute the in-memory implementations (repositories/memory/*)
 * for the Postgres ones (repositories/postgres/*) without changing any
 * service logic, and what keeps the domain portable per
 * docs/architecture/deployment-portability.md.
 */
import type {
  User,
  AccountType,
  UserEmployeeLink,
  LegalEntity,
  Role,
  Permission,
  UserRoleAssignment,
  EntityAccessGrant,
  EntityAccessScopeType,
  Session,
  MfaMethod,
  MfaRecoveryCode,
  AuthenticationAttempt,
  AuthenticationAttemptReason,
  SecurityAuditEvent,
} from "../domain/entities.ts";
import type { PasswordHash } from "../crypto/password.ts";
import type { EncryptedTotpSecret } from "../crypto/mfaSecretCipher.ts";
import type { DatabaseProvider } from "../../../../packages/shared/src/DatabaseProvider.ts";

export interface UserRepository {
  createUser(input: { email: string; accountType: AccountType }): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  /**
   * Same as findById, but (on the real Postgres implementation) takes a
   * row-level `SELECT ... FOR UPDATE` lock, held until the enclosing
   * transaction commits or rolls back — see accountSecurityService.ts's
   * disableAccount()/enableAccount(), which must serialize against a
   * concurrent disable/enable of the SAME target user (PR #10). The
   * in-memory implementation has no real concurrent transactions to guard
   * against and behaves exactly like findById.
   */
  findByIdForUpdate(id: string): Promise<User | null>;
  setStatus(userId: string, status: "active" | "disabled"): Promise<void>;
  setCredential(userId: string, hash: PasswordHash): Promise<void>;
  getCredential(userId: string): Promise<PasswordHash | null>;
  linkEmployee(link: { userId: string; employeeId: string; linkedBy: string }): Promise<UserEmployeeLink>;
  findActiveLinkByUserId(userId: string): Promise<UserEmployeeLink | null>;
  findActiveLinkByEmployeeId(employeeId: string): Promise<UserEmployeeLink | null>;
  unlinkEmployee(linkId: string, unlinkedBy: string): Promise<void>;
}

export interface OrganisationRepository {
  findLegalEntityByKey(key: string): Promise<LegalEntity | null>;
  findLegalEntityById(id: string): Promise<LegalEntity | null>;
  listLegalEntities(): Promise<LegalEntity[]>;
}

export interface RbacRepository {
  createRole(input: { key: string; name: string; description?: string }): Promise<Role>;
  findRoleByKey(key: string): Promise<Role | null>;
  createPermission(input: {
    key: string;
    description?: string;
    maxClassification: Permission["maxClassification"];
  }): Promise<Permission>;
  findPermissionByKey(key: string): Promise<Permission | null>;
  grantPermissionToRole(roleId: string, permissionId: string): Promise<void>;
  assignRole(input: { userId: string; roleId: string; grantedBy: string }): Promise<UserRoleAssignment>;
  revokeRoleAssignment(assignmentId: string, revokedBy: string): Promise<void>;
  listActiveRoleAssignments(userId: string): Promise<UserRoleAssignment[]>;
  listPermissionsForRole(roleId: string): Promise<Permission[]>;
  grantEntityAccess(input: {
    userId: string;
    scopeType: EntityAccessScopeType;
    legalEntityId?: string | null;
    businessUnitId?: string | null;
    departmentId?: string | null;
    grantedBy: string;
  }): Promise<EntityAccessGrant>;
  revokeEntityAccess(grantId: string, revokedBy: string): Promise<void>;
  listActiveEntityAccessGrants(userId: string): Promise<EntityAccessGrant[]>;
  /**
   * Every userId with a currently active (non-revoked) role assignment
   * granting a role that carries this exact permission key — a coarse,
   * classification/entity-blind candidate set. Consumers must still run
   * each candidate through `RbacService.authorize()` (or an equivalent
   * capability, e.g. `actorResolutionService.listEligibleActors()`) to
   * apply classification ceiling and entity-access-grant coverage — this
   * method alone is never sufficient for an authorization decision. See
   * docs/architecture/identity-foundation.md "Actor resolution" and
   * platform-services/workflow's ROLE-mode routing, this method's first
   * consumer.
   */
  listActiveUserIdsForPermission(permissionKey: string): Promise<string[]>;
}

export interface SessionRepository {
  create(input: {
    userId: string;
    tokenHash: string;
    expiresAt: string;
    mfaVerified: boolean;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<Session>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  findById(id: string): Promise<Session | null>;
  touchLastActive(id: string): Promise<void>;
  revoke(id: string, reason: string): Promise<void>;
  revokeAllForUser(userId: string, reason: string): Promise<number>;
  listActiveForUser(userId: string): Promise<Session[]>;
  expireDue(now: string): Promise<number>;
}

export interface MfaRepository {
  createMethod(input: { userId: string; secret: EncryptedTotpSecret }): Promise<MfaMethod>;
  findActiveOrPendingByUser(userId: string): Promise<MfaMethod | null>;
  activateMethod(id: string): Promise<void>;
  disableMethod(id: string, disabledBy: string): Promise<void>;
  replaceRecoveryCodes(input: {
    userId: string;
    generationId: string;
    codeHashes: string[];
  }): Promise<void>;
  findUnusedRecoveryCodeByHash(userId: string, codeHash: string): Promise<MfaRecoveryCode | null>;
  markRecoveryCodeUsed(id: string): Promise<void>;
}

export interface AttemptRepository {
  record(input: {
    email: string;
    succeeded: boolean;
    reason?: AuthenticationAttemptReason;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<AuthenticationAttempt>;
  countRecentFailures(input: { email?: string; ip?: string; sinceIso: string }): Promise<number>;
}

export interface AuditRepository {
  record(event: Omit<SecurityAuditEvent, "id" | "occurredAt">): Promise<SecurityAuditEvent>;
}

/**
 * PR #10 (identity-offboarding-revocation): the shared-transaction
 * primitive for accountSecurityService — account status change + session
 * revocation + security audit commit or roll back together (see
 * docs/architecture/identity-offboarding-revocation.md "Transaction
 * boundary"). `tx` is also exposed so an external caller (HRMS's
 * deactivation-request processor) can bind its OWN transaction-scoped
 * repositories to this exact connection, mirroring platform-services/
 * hrms's WorkflowTransaction/SystemActionContext.tx pattern from PR #9 —
 * never a second, nested DatabaseProvider.transaction() call.
 */
export interface UserSecurityTransaction {
  run<T>(fn: (repos: { users: UserRepository; sessions: SessionRepository; audit: AuditRepository }, tx: DatabaseProvider) => Promise<T>): Promise<T>;
}
