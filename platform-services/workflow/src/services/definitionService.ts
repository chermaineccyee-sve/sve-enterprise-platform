/**
 * Workflow definition lifecycle: DRAFT -> PUBLISHED -> RETIRED (PR brief
 * item 8). A definition (identified by a stable `key`) is a thin, status-
 * free header; its actual editable content lives on a version. Only one
 * version is ever mutated by this service: a DRAFT one, and only while it
 * remains DRAFT — publishing freezes it forever (PR brief item 36:
 * "running workflows must not depend on mutable draft definition data").
 *
 * Concurrency (PR brief item 33): version-number assignment happens under
 * an application-held row lock on the parent workflow_definitions row
 * (createDraftVersion) — never a bare MAX(version_number)+1. Publishing
 * itself locks the SPECIFIC version row being published, which also
 * serializes it against a concurrent step edit on the same version (both
 * acquire the same lock before writing) — see repositories/types.ts's
 * interface docs.
 */
import type { WorkflowDefinitionRepository, WorkflowDefinitionVersionRepository, WorkflowStepRepository, WorkflowTransaction } from "../repositories/types.ts";
import type { RbacService } from "../../../identity/src/services/rbacService.ts";
import type { AuditService } from "../../../identity/src/services/auditService.ts";
import type { SystemActionRegistry } from "../domain/systemActionRegistry.ts";
import { ForbiddenError } from "../../../identity/src/domain/errors.ts";
import { NotFoundError, ValidationError, InvalidStateError } from "../domain/errors.ts";
import type { WorkflowDefinition, WorkflowDefinitionVersion, WorkflowStep, CreateStepInput } from "../domain/workflow.ts";
import { PERMISSIONS, type ActorContext } from "./access.ts";

async function requirePermission(rbac: RbacService, actor: ActorContext, key: string): Promise<void> {
  const result = await rbac.authorize({ userId: actor.userId, permissionKey: key });
  if (!result.allowed) throw new ForbiddenError(key);
}

/**
 * Validates a DRAFT version's steps before publish (PR brief item 35).
 * Deliberately conservative: any ambiguity fails closed (the definition
 * does not publish) rather than guessing intent.
 */
function validateStepsForPublish(steps: WorkflowStep[], systemActions: SystemActionRegistry): void {
  if (steps.length === 0) throw new ValidationError("A workflow definition must have at least one step to publish.");

  const sorted = [...steps].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  sorted.forEach((step, index) => {
    if (step.sequenceNumber !== index + 1) {
      throw new ValidationError("Step sequence numbers must be contiguous, starting at 1, with no gaps or duplicates.");
    }
  });

  for (const step of sorted) {
    if (step.stepType === "SYSTEM_ACTION") {
      if (!step.systemActionHandlerKey) throw new ValidationError(`Step ${step.sequenceNumber}: a SYSTEM_ACTION step requires systemActionHandlerKey.`);
      if (!systemActions.isRegistered(step.systemActionHandlerKey)) {
        throw new ValidationError(`Step ${step.sequenceNumber}: system action handler '${step.systemActionHandlerKey}' is not registered.`);
      }
      continue;
    }
    if (!step.assignmentMode) throw new ValidationError(`Step ${step.sequenceNumber}: ${step.stepType} steps require an assignmentMode.`);
    if (step.assignmentMode === "ROLE" && !step.assignedPermissionKey) {
      throw new ValidationError(`Step ${step.sequenceNumber}: ROLE assignment requires assignedPermissionKey.`);
    }
    if (step.stepType === "APPROVAL") {
      if (!step.permittedDecisions || step.permittedDecisions.length === 0) {
        throw new ValidationError(`Step ${step.sequenceNumber}: an APPROVAL step requires at least one permitted decision.`);
      }
      if (step.permittedDecisions.includes("RETURN") && step.sequenceNumber === 1) {
        throw new ValidationError(`Step ${step.sequenceNumber}: RETURN is not a valid decision on the first step (there is no previous step to return to).`);
      }
    }
  }
}

export function createDefinitionService(deps: {
  definitions: WorkflowDefinitionRepository;
  versions: WorkflowDefinitionVersionRepository;
  steps: WorkflowStepRepository;
  rbac: RbacService;
  audit: AuditService;
  transactions: WorkflowTransaction;
  systemActions: SystemActionRegistry;
}) {
  return {
    async createDefinition(actor: ActorContext, input: { key: string; name: string; description?: string | null }): Promise<{ definition: WorkflowDefinition; version: WorkflowDefinitionVersion }> {
      if (!input.key?.trim()) throw new ValidationError("key is required.");
      if (!input.name?.trim()) throw new ValidationError("name is required.");
      await requirePermission(deps.rbac, actor, PERMISSIONS.DEFINITION_CREATE);

      const existing = await deps.definitions.findByKey(input.key);
      if (existing) throw new ValidationError("A workflow definition with this key already exists.");

      const result = await deps.transactions.run(async (repos) => {
        const definition = await repos.definitions.create({ key: input.key, name: input.name, description: input.description ?? null, createdBy: actor.userId });
        const version = await repos.versions.create({ definitionId: definition.id, versionNumber: 1, createdBy: actor.userId });
        return { definition, version };
      });

      await deps.audit.record({ actorUserId: actor.userId, actorEmail: actor.email, action: "workflow.definition.created", resourceType: "workflow_definition", resourceId: result.definition.id, changeAfter: { key: input.key } });
      return result;
    },

    /** Opens a new editable DRAFT version for an existing definition — e.g. to make changes after a prior version was published. Version-number assignment is lock-guarded (see file header). */
    async createDraftVersion(actor: ActorContext, definitionId: string): Promise<WorkflowDefinitionVersion> {
      await requirePermission(deps.rbac, actor, PERMISSIONS.DEFINITION_UPDATE);
      return deps.transactions.run(async (repos) => {
        const definition = await repos.definitions.findByIdForUpdate(definitionId);
        if (!definition) throw new NotFoundError("Workflow definition");
        const max = await repos.versions.maxVersionNumber(definitionId);
        return repos.versions.create({ definitionId, versionNumber: max + 1, createdBy: actor.userId });
      });
    },

    async getDefinition(actor: ActorContext, id: string): Promise<WorkflowDefinition> {
      await requirePermission(deps.rbac, actor, PERMISSIONS.DEFINITION_READ);
      const definition = await deps.definitions.findById(id);
      if (!definition) throw new NotFoundError("Workflow definition");
      return definition;
    },

    async listDefinitions(actor: ActorContext): Promise<WorkflowDefinition[]> {
      await requirePermission(deps.rbac, actor, PERMISSIONS.DEFINITION_READ);
      return deps.definitions.list();
    },

    async listVersions(actor: ActorContext, definitionId: string): Promise<WorkflowDefinitionVersion[]> {
      await requirePermission(deps.rbac, actor, PERMISSIONS.DEFINITION_READ);
      return deps.versions.listByDefinition(definitionId);
    },

    async getVersion(actor: ActorContext, versionId: string): Promise<{ version: WorkflowDefinitionVersion; steps: WorkflowStep[] }> {
      await requirePermission(deps.rbac, actor, PERMISSIONS.DEFINITION_READ);
      const version = await deps.versions.findById(versionId);
      if (!version) throw new NotFoundError("Workflow definition version");
      const steps = await deps.steps.listByVersion(versionId);
      return { version, steps };
    },

    async addStep(actor: ActorContext, versionId: string, input: CreateStepInput): Promise<WorkflowStep> {
      if (!input.name?.trim()) throw new ValidationError("name is required.");
      if (!input.sequenceNumber || input.sequenceNumber < 1) throw new ValidationError("sequenceNumber must be >= 1.");
      await requirePermission(deps.rbac, actor, PERMISSIONS.DEFINITION_UPDATE);
      return deps.transactions.run(async (repos) => {
        const version = await repos.versions.findByIdForUpdate(versionId);
        if (!version) throw new NotFoundError("Workflow definition version");
        if (version.status !== "DRAFT") throw new InvalidStateError("Only a DRAFT version can be edited.");
        const clashing = await repos.steps.findBySequence(versionId, input.sequenceNumber);
        if (clashing) throw new ValidationError(`A step with sequenceNumber ${input.sequenceNumber} already exists on this version.`);
        return repos.steps.create(versionId, input);
      });
    },

    async updateStep(actor: ActorContext, versionId: string, stepId: string, input: Partial<CreateStepInput>): Promise<WorkflowStep> {
      await requirePermission(deps.rbac, actor, PERMISSIONS.DEFINITION_UPDATE);
      return deps.transactions.run(async (repos) => {
        const version = await repos.versions.findByIdForUpdate(versionId);
        if (!version) throw new NotFoundError("Workflow definition version");
        if (version.status !== "DRAFT") throw new InvalidStateError("Only a DRAFT version can be edited.");
        const step = await repos.steps.findById(stepId);
        if (!step || step.versionId !== versionId) throw new NotFoundError("Workflow step");
        return repos.steps.update(stepId, input);
      });
    },

    async deleteStep(actor: ActorContext, versionId: string, stepId: string): Promise<void> {
      await requirePermission(deps.rbac, actor, PERMISSIONS.DEFINITION_UPDATE);
      await deps.transactions.run(async (repos) => {
        const version = await repos.versions.findByIdForUpdate(versionId);
        if (!version) throw new NotFoundError("Workflow definition version");
        if (version.status !== "DRAFT") throw new InvalidStateError("Only a DRAFT version can be edited.");
        const step = await repos.steps.findById(stepId);
        if (!step || step.versionId !== versionId) throw new NotFoundError("Workflow step");
        await repos.steps.delete(stepId);
      });
    },

    async publish(actor: ActorContext, versionId: string): Promise<WorkflowDefinitionVersion> {
      await requirePermission(deps.rbac, actor, PERMISSIONS.DEFINITION_PUBLISH);
      const published = await deps.transactions.run(async (repos) => {
        const version = await repos.versions.findByIdForUpdate(versionId);
        if (!version) throw new NotFoundError("Workflow definition version");
        if (version.status !== "DRAFT") throw new InvalidStateError("Only a DRAFT version can be published.");
        const steps = await repos.steps.listByVersion(versionId);
        validateStepsForPublish(steps, deps.systemActions);
        return repos.versions.updateStatus(versionId, { status: "PUBLISHED" });
      });
      await deps.audit.record({ actorUserId: actor.userId, actorEmail: actor.email, action: "workflow.definition.published", resourceType: "workflow_definition_version", resourceId: published.id, changeAfter: { versionNumber: published.versionNumber } });
      return published;
    },

    async retire(actor: ActorContext, versionId: string): Promise<WorkflowDefinitionVersion> {
      await requirePermission(deps.rbac, actor, PERMISSIONS.DEFINITION_RETIRE);
      const retired = await deps.transactions.run(async (repos) => {
        const version = await repos.versions.findByIdForUpdate(versionId);
        if (!version) throw new NotFoundError("Workflow definition version");
        if (version.status !== "PUBLISHED") throw new InvalidStateError("Only a PUBLISHED version can be retired.");
        return repos.versions.updateStatus(versionId, { status: "RETIRED" });
      });
      await deps.audit.record({ actorUserId: actor.userId, actorEmail: actor.email, action: "workflow.definition.retired", resourceType: "workflow_definition_version", resourceId: retired.id, changeAfter: { versionNumber: retired.versionNumber } });
      return retired;
    },
  };
}

export type DefinitionService = ReturnType<typeof createDefinitionService>;
