/**
 * Domain types mirroring the tables in database/migrations/
 * 001_identity-foundation/migration.sql. Plain interfaces only (no classes
 * with parameter-property shorthand, no enums) — this codebase runs
 * TypeScript directly via Node's built-in type stripping, which requires
 * erasable syntax only. See docs/architecture/identity-foundation.md
 * "Why plain .ts files, no build step".
 */
import type { DataClassification } from "../../../../packages/types/src/entity-context.ts";
import type { EncryptedTotpSecret } from "../crypto/mfaSecretCipher.ts";

export type AccountType = "employee" | "contractor" | "external" | "service";
export type AccountStatus = "active" | "disabled";

/** A User is an authentication identity. Not every User is an Employee. */
export interface User {
  id: string;
  email: string;
  accountType: AccountType;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

/** The minimal, optional hook to a future Employee Master record. */
export interface UserEmployeeLink {
  userId: string;
  employeeId: string;
  linkedAt: string;
  linkedBy: string;
}

export interface Group {
  id: string;
  key: string;
  name: string;
}

export interface LegalEntity {
  id: string;
  groupId: string;
  key: string;
  name: string;
  jurisdiction: string;
  currency: string;
  isGroupHeadquarters: boolean;
}

export interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
}

export interface Permission {
  id: string;
  key: string;
  description: string | null;
  maxClassification: DataClassification;
}

export interface UserRoleAssignment {
  id: string;
  userId: string;
  roleId: string;
  grantedBy: string;
  grantedAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
}

export type EntityAccessScopeType = "group" | "legal_entity" | "business_unit" | "department";

export interface EntityAccessGrant {
  id: string;
  userId: string;
  scopeType: EntityAccessScopeType;
  legalEntityId: string | null;
  businessUnitId: string | null;
  departmentId: string | null;
  grantedBy: string;
  grantedAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
}

/** The target of an authorization check — what the actor wants to act on. */
export interface AccessTarget {
  legalEntityId?: string;
  businessUnitId?: string;
  departmentId?: string;
  recordClassification?: DataClassification;
}

export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
  mfaVerified: boolean;
  ip: string | null;
  userAgent: string | null;
}

export type MfaMethodType = "totp";
export type MfaMethodStatus = "pending" | "active" | "disabled";

export interface MfaMethod {
  id: string;
  userId: string;
  methodType: MfaMethodType;
  /** AES-256-GCM ciphertext (see src/crypto/mfaSecretCipher.ts) — genuinely encrypted, never the plaintext TOTP secret. */
  secret: EncryptedTotpSecret;
  status: MfaMethodStatus;
  createdAt: string;
  activatedAt: string | null;
  disabledAt: string | null;
  disabledBy: string | null;
}

export interface MfaRecoveryCode {
  id: string;
  userId: string;
  generationId: string;
  codeHash: string;
  usedAt: string | null;
  createdAt: string;
}

export type AuthenticationAttemptReason =
  | "invalid_password"
  | "unknown_account"
  | "throttled"
  /** Primary factor (password) succeeded and a challenge was issued — succeeded=true, never counted as a failure. See "Rate-limit semantics" in identity-foundation.md. */
  | "mfa_required"
  | "mfa_failed"
  | "recovery_code_invalid"
  | "account_disabled"
  | "success";

export interface AuthenticationAttempt {
  id: string;
  email: string;
  succeeded: boolean;
  reason: AuthenticationAttemptReason | null;
  ip: string | null;
  userAgent: string | null;
  occurredAt: string;
}

export interface SecurityAuditEvent {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  legalEntityId: string | null;
  sessionId: string | null;
  changeBefore: Record<string, unknown> | null;
  changeAfter: Record<string, unknown> | null;
  sourceIp: string | null;
  sourceUserAgent: string | null;
  occurredAt: string;
}
