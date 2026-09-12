/**
 * Data Vault domain service — the first real business-data consumer of
 * platform-services/identity's rbacService.authorize() (PR brief item 7).
 * Every read and write independently re-derives ALLOW/DENY from the
 * caller's userId, the target record's legal entity and classification,
 * and the caller's own role/entity-access grants in Identity's own
 * database — never from anything the client claims about itself.
 *
 * Dependency direction: this file (Data Vault) depends on Identity's
 * RbacService/AuditService/OrganisationRepository *contracts* — imported
 * from platform-services/identity's source tree, never copied or
 * reimplemented here. platform-services/identity has no corresponding
 * dependency on this package. See docs/architecture/
 * data-vault-foundation.md "Module ownership and dependency direction".
 */
import type { DataVaultRepository } from "../repositories/types.ts";
import type { OrganisationRepository } from "../../../identity/src/repositories/types.ts";
import type { RbacService } from "../../../identity/src/services/rbacService.ts";
import type { AuditService } from "../../../identity/src/services/auditService.ts";
import type {
  DataVaultRecord,
  CreateDataVaultRecordInput,
  UpdateDataVaultRecordInput,
  DataVaultRecordFilter,
} from "../domain/dataVault.ts";
import type { DataClassification } from "../../../../packages/types/src/entity-context.ts";
import { ForbiddenError } from "../../../identity/src/domain/errors.ts";
import { NotFoundError, ValidationError } from "../domain/errors.ts";

export const PERMISSIONS = {
  READ: "data_vault.records.read",
  READ_PRIVILEGED: "data_vault.records.read.privileged",
  CREATE: "data_vault.records.create",
  CREATE_PRIVILEGED: "data_vault.records.create.privileged",
  UPDATE: "data_vault.records.update",
  UPDATE_PRIVILEGED: "data_vault.records.update.privileged",
  ARCHIVE: "data_vault.records.archive",
  ARCHIVE_PRIVILEGED: "data_vault.records.archive.privileged",
} as const;

const REQUIRED_STRING_FIELDS = ["jurisdiction", "category", "topic", "source", "tier", "confidence"] as const;
const VALID_CLASSIFICATIONS: DataClassification[] = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED", "PRIVILEGED"];
const SENSITIVE_VIEW_CLASSIFICATIONS: DataClassification[] = ["CONFIDENTIAL", "RESTRICTED", "PRIVILEGED"];

interface ActorContext {
  userId: string;
  email: string;
  ip?: string | null;
  userAgent?: string | null;
}

async function checkAccess(
  rbac: RbacService,
  userId: string,
  baseKey: string,
  privilegedKey: string,
  target: { legalEntityId?: string; recordClassification?: DataClassification },
) {
  const base = await rbac.authorize({ userId, permissionKey: baseKey, target });
  if (base.allowed) return base;
  if (target.recordClassification === "PRIVILEGED") {
    return rbac.authorize({ userId, permissionKey: privilegedKey, target });
  }
  return base;
}

/**
 * Gate for write operations on an EXISTING record: throws NotFoundError
 * (hiding existence, exactly like getRecord) when the caller cannot even
 * READ the record at its current entity/classification — they must never
 * learn it exists at all. Throws ForbiddenError (honestly reporting that
 * the record exists but the action is not permitted) only once READ
 * access is established, so a user who can legitimately see a record but
 * lacks the specific write permission gets an accurate, non-misleading
 * response instead of a confusing 404 for something they can already view.
 */
async function requireVisibleThenAuthorized(
  rbac: RbacService,
  userId: string,
  actionKey: string,
  actionPrivilegedKey: string,
  target: { legalEntityId: string; recordClassification: DataClassification },
): Promise<void> {
  const canSee = await checkAccess(rbac, userId, PERMISSIONS.READ, PERMISSIONS.READ_PRIVILEGED, target);
  if (!canSee.allowed) throw new NotFoundError("Data Vault record");
  const canAct = await checkAccess(rbac, userId, actionKey, actionPrivilegedKey, target);
  if (!canAct.allowed) throw new ForbiddenError(actionKey);
}

function snapshotOf(record: DataVaultRecord): Record<string, unknown> {
  // Full field snapshot — this table sits behind the same database access
  // control as the live record, unlike security_audit_events, which
  // deliberately never receives this (see the audit calls below and
  // docs/architecture/data-vault-foundation.md "Audit model does not
  // duplicate record content").
  return { ...record };
}

function validateCreateInput(input: CreateDataVaultRecordInput): void {
  if (!input.legalEntityId) throw new ValidationError("legalEntityId is required.");
  for (const field of REQUIRED_STRING_FIELDS) {
    const value = input[field];
    if (typeof value !== "string" || !value.trim()) throw new ValidationError(`${field} is required.`);
  }
  if (!VALID_CLASSIFICATIONS.includes(input.classification)) throw new ValidationError("classification is invalid.");
}

export function createDataVaultService(deps: { dataVault: DataVaultRepository; rbac: RbacService; organisation: OrganisationRepository; audit: AuditService }) {
  return {
    async listRecords(actor: ActorContext, filter: DataVaultRecordFilter): Promise<DataVaultRecord[]> {
      // Authorization is applied to every candidate row before it is ever
      // returned to the caller — never "fetch everything, hide client-side"
      // (PR brief item 13).
      const candidates = await deps.dataVault.list(filter);
      const allowed: DataVaultRecord[] = [];
      for (const record of candidates) {
        const result = await checkAccess(deps.rbac, actor.userId, PERMISSIONS.READ, PERMISSIONS.READ_PRIVILEGED, {
          legalEntityId: record.legalEntityId,
          recordClassification: record.classification,
        });
        if (result.allowed) allowed.push(record);
      }
      return allowed;
    },

    async getRecord(actor: ActorContext, id: string): Promise<DataVaultRecord> {
      const record = await deps.dataVault.findById(id);
      if (!record) throw new NotFoundError("Data Vault record");
      const result = await checkAccess(deps.rbac, actor.userId, PERMISSIONS.READ, PERMISSIONS.READ_PRIVILEGED, {
        legalEntityId: record.legalEntityId,
        recordClassification: record.classification,
      });
      if (!result.allowed) {
        // Same NotFoundError as a genuinely missing id — a denied caller
        // must not learn the record exists (PR brief items 12 and 18: no
        // IDOR / broken object-level authorization, no existence leak
        // through error responses).
        await deps.audit.record({
          actorUserId: actor.userId,
          actorEmail: actor.email,
          action: "data_vault.access.denied",
          resourceType: "data_vault_record",
          resourceId: id,
          legalEntityId: record.legalEntityId,
          changeAfter: { reason: result.reason },
          sourceIp: actor.ip,
          sourceUserAgent: actor.userAgent,
        });
        throw new NotFoundError("Data Vault record");
      }
      if (SENSITIVE_VIEW_CLASSIFICATIONS.includes(record.classification)) {
        await deps.audit.record({
          actorUserId: actor.userId,
          actorEmail: actor.email,
          action: "data_vault.record.viewed",
          resourceType: "data_vault_record",
          resourceId: record.id,
          legalEntityId: record.legalEntityId,
          changeAfter: { classification: record.classification },
          sourceIp: actor.ip,
          sourceUserAgent: actor.userAgent,
        });
      }
      return record;
    },

    async createRecord(actor: ActorContext, input: CreateDataVaultRecordInput): Promise<DataVaultRecord> {
      validateCreateInput(input);
      const legalEntity = await deps.organisation.findLegalEntityById(input.legalEntityId);
      if (!legalEntity) throw new ValidationError("legalEntityId does not refer to a known legal entity.");

      const result = await checkAccess(deps.rbac, actor.userId, PERMISSIONS.CREATE, PERMISSIONS.CREATE_PRIVILEGED, {
        legalEntityId: input.legalEntityId,
        recordClassification: input.classification,
      });
      if (!result.allowed) throw new ForbiddenError(PERMISSIONS.CREATE);

      const record = await deps.dataVault.create({ ...input, createdBy: actor.userId });
      await deps.audit.record({
        actorUserId: actor.userId,
        actorEmail: actor.email,
        action: "data_vault.record.created",
        resourceType: "data_vault_record",
        resourceId: record.id,
        legalEntityId: record.legalEntityId,
        changeAfter: { classification: record.classification, status: record.status, recordCode: record.recordCode },
        sourceIp: actor.ip,
        sourceUserAgent: actor.userAgent,
      });
      return record;
    },

    async updateRecord(actor: ActorContext, id: string, input: UpdateDataVaultRecordInput): Promise<DataVaultRecord> {
      const existing = await deps.dataVault.findById(id);
      if (!existing) throw new NotFoundError("Data Vault record");

      // The caller must be able to see AND be authorized to update the
      // record's CURRENT classification/entity to touch it at all.
      await requireVisibleThenAuthorized(deps.rbac, actor.userId, PERMISSIONS.UPDATE, PERMISSIONS.UPDATE_PRIVILEGED, {
        legalEntityId: existing.legalEntityId,
        recordClassification: existing.classification,
      });

      const newLegalEntityId = input.legalEntityId ?? existing.legalEntityId;
      if (input.legalEntityId && input.legalEntityId !== existing.legalEntityId) {
        const legalEntity = await deps.organisation.findLegalEntityById(input.legalEntityId);
        if (!legalEntity) throw new ValidationError("legalEntityId does not refer to a known legal entity.");
      }
      const newClassification = input.classification ?? existing.classification;
      if (input.classification && input.classification !== existing.classification && !VALID_CLASSIFICATIONS.includes(input.classification)) {
        throw new ValidationError("classification is invalid.");
      }

      // ...and, independently, against whatever it is CHANGING TO — this is
      // what stops a caller with only ordinary update rights from
      // reclassifying a record up into RESTRICTED/PRIVILEGED, or moving it
      // into an entity they hold no access grant for.
      if (newLegalEntityId !== existing.legalEntityId || newClassification !== existing.classification) {
        const newAccess = await checkAccess(deps.rbac, actor.userId, PERMISSIONS.UPDATE, PERMISSIONS.UPDATE_PRIVILEGED, {
          legalEntityId: newLegalEntityId,
          recordClassification: newClassification,
        });
        if (!newAccess.allowed) throw new ForbiddenError(PERMISSIONS.UPDATE);
      }

      await deps.dataVault.addVersion({
        recordId: existing.id,
        version: existing.version,
        snapshot: snapshotOf(existing),
        changeNote: input.changeNote ?? null,
        changedBy: actor.userId,
      });

      const updated = await deps.dataVault.update(id, { ...input, updatedBy: actor.userId });

      await deps.audit.record({
        actorUserId: actor.userId,
        actorEmail: actor.email,
        action: "data_vault.record.updated",
        resourceType: "data_vault_record",
        resourceId: updated.id,
        legalEntityId: updated.legalEntityId,
        changeBefore: { status: existing.status, classification: existing.classification },
        changeAfter: { status: updated.status, classification: updated.classification },
        sourceIp: actor.ip,
        sourceUserAgent: actor.userAgent,
      });
      if (newClassification !== existing.classification) {
        await deps.audit.record({
          actorUserId: actor.userId,
          actorEmail: actor.email,
          action: "data_vault.record.classification_changed",
          resourceType: "data_vault_record",
          resourceId: updated.id,
          legalEntityId: updated.legalEntityId,
          changeBefore: { classification: existing.classification },
          changeAfter: { classification: updated.classification },
          sourceIp: actor.ip,
          sourceUserAgent: actor.userAgent,
        });
      }
      if (newLegalEntityId !== existing.legalEntityId) {
        await deps.audit.record({
          actorUserId: actor.userId,
          actorEmail: actor.email,
          action: "data_vault.record.entity_changed",
          resourceType: "data_vault_record",
          resourceId: updated.id,
          legalEntityId: updated.legalEntityId,
          changeBefore: { legalEntityId: existing.legalEntityId },
          changeAfter: { legalEntityId: updated.legalEntityId },
          sourceIp: actor.ip,
          sourceUserAgent: actor.userAgent,
        });
      }
      return updated;
    },

    async archiveRecord(actor: ActorContext, id: string): Promise<DataVaultRecord> {
      const existing = await deps.dataVault.findById(id);
      if (!existing) throw new NotFoundError("Data Vault record");

      await requireVisibleThenAuthorized(deps.rbac, actor.userId, PERMISSIONS.ARCHIVE, PERMISSIONS.ARCHIVE_PRIVILEGED, {
        legalEntityId: existing.legalEntityId,
        recordClassification: existing.classification,
      });

      await deps.dataVault.addVersion({
        recordId: existing.id,
        version: existing.version,
        snapshot: snapshotOf(existing),
        changeNote: "Archived",
        changedBy: actor.userId,
      });
      const archived = await deps.dataVault.archive(id, actor.userId);
      await deps.audit.record({
        actorUserId: actor.userId,
        actorEmail: actor.email,
        action: "data_vault.record.archived",
        resourceType: "data_vault_record",
        resourceId: archived.id,
        legalEntityId: archived.legalEntityId,
        changeBefore: { status: existing.status },
        changeAfter: { status: archived.status },
        sourceIp: actor.ip,
        sourceUserAgent: actor.userAgent,
      });
      return archived;
    },
  };
}

export type DataVaultService = ReturnType<typeof createDataVaultService>;
