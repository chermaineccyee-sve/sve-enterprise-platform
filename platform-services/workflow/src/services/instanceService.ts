/**
 * Workflow instance lifecycle: start / read / list / cancel. See docs/
 * architecture/workflow-approval-foundation.md "Instances", "Idempotency",
 * "Entity and classification security".
 */
import type { WorkflowDefinitionRepository, WorkflowDefinitionVersionRepository, WorkflowStepRepository, WorkflowInstanceRepository, WorkflowTaskRepository, WorkflowEventRepository, WorkflowTransaction } from "../repositories/types.ts";
import type { RbacService } from "../../../identity/src/services/rbacService.ts";
import type { AuditService } from "../../../identity/src/services/auditService.ts";
import type { OrganisationRepository, UserRepository } from "../../../identity/src/repositories/types.ts";
import type { InstanceEngine } from "./instanceEngine.ts";
import { ForbiddenError } from "../../../identity/src/domain/errors.ts";
import { NotFoundError, ValidationError, InvalidStateError } from "../domain/errors.ts";
import { isRegisteredSubjectType } from "../domain/subjectType.ts";
import type { WorkflowInstance, WorkflowEvent, StartWorkflowInput, InstanceFilter, DataClassification } from "../domain/workflow.ts";
import { PERMISSIONS, checkAccess, entityCeiling, type ActorContext } from "./access.ts";

const CLASSIFICATION_ORDER: DataClassification[] = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED", "PRIVILEGED"];

function isDuplicateActiveInstanceError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  const code = (error as { code?: string } | null)?.code;
  return code === "23505" || message.toLowerCase().includes("active workflow instance already exists");
}

export function createInstanceService(deps: {
  definitions: WorkflowDefinitionRepository;
  versions: WorkflowDefinitionVersionRepository;
  steps: WorkflowStepRepository;
  instances: WorkflowInstanceRepository;
  tasks: WorkflowTaskRepository;
  events: WorkflowEventRepository;
  organisation: OrganisationRepository;
  users: UserRepository;
  rbac: RbacService;
  audit: AuditService;
  transactions: WorkflowTransaction;
  engine: InstanceEngine;
}) {
  async function resolveReadAccess(actor: ActorContext, instance: WorkflowInstance): Promise<boolean> {
    if (instance.requesterUserId === actor.userId) return true;
    const access = await checkAccess(deps.rbac, actor.userId, PERMISSIONS.INSTANCE_READ, PERMISSIONS.INSTANCE_READ_PRIVILEGED, { legalEntityId: instance.legalEntityId, recordClassification: instance.dataClassification });
    if (access.allowed) return true;
    const tasks = await deps.tasks.listByInstance(instance.id);
    return tasks.some((t) => t.assignedUserId === actor.userId);
  }

  return {
    async startWorkflow(actor: ActorContext, input: StartWorkflowInput): Promise<WorkflowInstance> {
      if (!input.definitionKey?.trim()) throw new ValidationError("definitionKey is required.");
      if (!input.subjectType?.trim()) throw new ValidationError("subjectType is required.");
      if (!input.subjectId?.trim()) throw new ValidationError("subjectId is required.");
      if (!input.legalEntityId?.trim()) throw new ValidationError("legalEntityId is required.");
      if (!isRegisteredSubjectType(input.subjectType)) throw new ValidationError(`subjectType '${input.subjectType}' is not registered.`);

      const definition = await deps.definitions.findByKey(input.definitionKey);
      if (!definition) throw new ValidationError("definitionKey does not refer to a known workflow definition.");

      const legalEntity = await deps.organisation.findLegalEntityById(input.legalEntityId);
      if (!legalEntity) throw new ValidationError("legalEntityId does not refer to a known legal entity.");
      const ceiling = entityCeiling(legalEntity);
      const dataClassification = input.dataClassification ?? ceiling;
      if (CLASSIFICATION_ORDER.indexOf(dataClassification) < CLASSIFICATION_ORDER.indexOf(ceiling)) {
        throw new ValidationError("dataClassification cannot be lower than the legal entity's own classification ceiling.");
      }

      const access = await checkAccess(deps.rbac, actor.userId, PERMISSIONS.INSTANCE_START, PERMISSIONS.INSTANCE_START_PRIVILEGED, { legalEntityId: input.legalEntityId, recordClassification: dataClassification });
      if (!access.allowed) throw new ForbiddenError(PERMISSIONS.INSTANCE_START);

      // The latest PUBLISHED version is always used for a new instance
      // (PR brief item 36) — an older PUBLISHED version, if any, remains
      // valid ONLY for instances already bound to it; retiring it is a
      // separate, explicit administrative action.
      const versions = await deps.versions.listByDefinition(definition.id);
      const published = versions.filter((v) => v.status === "PUBLISHED").sort((a, b) => b.versionNumber - a.versionNumber)[0];
      if (!published) throw new ValidationError("This workflow definition has no published version.");

      if (input.idempotencyKey) {
        const existing = await deps.instances.findByIdempotencyKey(definition.id, input.idempotencyKey);
        if (existing) return existing;
      }

      let subjectActorUserId = input.subjectActorUserId ?? null;
      if (!subjectActorUserId && input.subjectEmployeeId) {
        const link = await deps.users.findActiveLinkByEmployeeId(input.subjectEmployeeId);
        subjectActorUserId = link?.userId ?? null;
      }

      const context = input.stepAssignments ? { ...(input.context ?? {}), stepAssignments: input.stepAssignments } : (input.context ?? null);

      try {
        const created = await deps.transactions.run(async (repos, tx) => {
          const instance = await repos.instances.create({
            definitionId: definition.id,
            versionId: published.id,
            subjectType: input.subjectType,
            subjectId: input.subjectId,
            legalEntityId: input.legalEntityId,
            dataClassification,
            subjectEmployeeId: input.subjectEmployeeId ?? null,
            requesterUserId: actor.userId,
            subjectActorUserId,
            idempotencyKey: input.idempotencyKey ?? null,
            context,
            createdBy: actor.userId,
          });
          await repos.events.append({ instanceId: instance.id, eventType: "instance_started", eventData: { definitionKey: input.definitionKey, versionNumber: published.versionNumber }, recordedBy: actor.userId });
          const steps = await repos.steps.listByVersion(published.id);
          const firstStep = steps[0];
          if (!firstStep) throw new InvalidStateError("Published version has no steps — this should never happen (publish validation requires at least one).");
          return deps.engine.activateStep(repos, instance, firstStep, actor.userId, tx);
        });
        await deps.audit.record({ actorUserId: actor.userId, actorEmail: actor.email, action: "workflow.instance.started", resourceType: "workflow_instance", resourceId: created.id, legalEntityId: input.legalEntityId, changeAfter: { definitionKey: input.definitionKey, status: created.status } });
        return created;
      } catch (error) {
        if (isDuplicateActiveInstanceError(error)) {
          throw new InvalidStateError("An active workflow instance already exists for this definition and subject.");
        }
        throw error;
      }
    },

    async getInstance(actor: ActorContext, id: string): Promise<WorkflowInstance> {
      const instance = await deps.instances.findById(id);
      if (!instance) throw new NotFoundError("Workflow instance");
      if (!(await resolveReadAccess(actor, instance))) throw new NotFoundError("Workflow instance");
      return instance;
    },

    async getInstanceHistory(actor: ActorContext, id: string): Promise<WorkflowEvent[]> {
      const instance = await deps.instances.findById(id);
      if (!instance) throw new NotFoundError("Workflow instance");
      if (!(await resolveReadAccess(actor, instance))) throw new NotFoundError("Workflow instance");
      return deps.events.listByInstance(id);
    },

    async listInstances(actor: ActorContext, filter: InstanceFilter): Promise<WorkflowInstance[]> {
      const candidates = await deps.instances.list(filter);
      const visible: WorkflowInstance[] = [];
      for (const instance of candidates) {
        if (await resolveReadAccess(actor, instance)) visible.push(instance);
      }
      return visible;
    },

    async cancelInstance(actor: ActorContext, id: string): Promise<WorkflowInstance> {
      const instance = await deps.instances.findById(id);
      if (!instance) throw new NotFoundError("Workflow instance");
      if (instance.requesterUserId !== actor.userId) {
        const access = await checkAccess(deps.rbac, actor.userId, PERMISSIONS.INSTANCE_CANCEL, PERMISSIONS.INSTANCE_CANCEL_PRIVILEGED, { legalEntityId: instance.legalEntityId, recordClassification: instance.dataClassification });
        if (!access.allowed) throw new ForbiddenError(PERMISSIONS.INSTANCE_CANCEL);
      }

      const updated = await deps.transactions.run(async (repos) => {
        const locked = await repos.instances.findByIdForUpdate(id);
        if (!locked) throw new NotFoundError("Workflow instance");
        if (locked.status !== "ACTIVE") throw new InvalidStateError("Only an ACTIVE instance can be cancelled.");
        if (locked.currentStepId) {
          const tasks = await repos.tasks.listByInstance(id);
          const openTask = tasks.find((t) => t.stepId === locked.currentStepId && t.status === "PENDING");
          if (openTask) await repos.tasks.transitionStatus(openTask.id, "PENDING", { status: "CANCELLED" });
        }
        await repos.events.append({ instanceId: id, eventType: "instance_cancelled", recordedBy: actor.userId });
        return repos.instances.updateProgress(id, { status: "CANCELLED", currentStepId: null });
      });
      await deps.audit.record({ actorUserId: actor.userId, actorEmail: actor.email, action: "workflow.instance.cancelled", resourceType: "workflow_instance", resourceId: id, legalEntityId: instance.legalEntityId, changeBefore: { status: instance.status }, changeAfter: { status: "CANCELLED" } });
      return updated;
    },
  };
}

export type InstanceService = ReturnType<typeof createInstanceService>;
