import { randomUUID } from "node:crypto";
import type { WorkflowInstanceRepository } from "../types.ts";
import type { InMemoryStore } from "./inMemoryStore.ts";
import type { WorkflowInstance, DataClassification } from "../../domain/workflow.ts";

export function createInMemoryWorkflowInstanceRepository(store: InMemoryStore): WorkflowInstanceRepository {
  return {
    async create(input): Promise<WorkflowInstance> {
      // Mirrors the DB's partial UNIQUE(definition_id, subject_type,
      // subject_id) WHERE status='ACTIVE' index — the natural uniqueness
      // invariant every caller gets for free, even without an
      // idempotency key (see docs "Idempotency").
      if (store.instances.some((i) => i.definitionId === input.definitionId && i.subjectType === input.subjectType && i.subjectId === input.subjectId && i.status === "ACTIVE")) {
        throw new Error("An active workflow instance already exists for this definition and subject.");
      }
      const now = new Date().toISOString();
      const record: WorkflowInstance = {
        id: randomUUID(),
        definitionId: input.definitionId,
        versionId: input.versionId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        legalEntityId: input.legalEntityId,
        dataClassification: input.dataClassification as DataClassification,
        subjectEmployeeId: input.subjectEmployeeId ?? null,
        requesterUserId: input.requesterUserId,
        subjectActorUserId: input.subjectActorUserId ?? null,
        status: "ACTIVE",
        outcome: null,
        failureCategory: null,
        currentStepId: null,
        idempotencyKey: input.idempotencyKey ?? null,
        context: input.context ?? null,
        startedAt: now,
        completedAt: null,
        cancelledAt: null,
        createdBy: input.createdBy,
        updatedAt: now,
      };
      store.instances.push(record);
      return record;
    },
    async findById(id) {
      return store.instances.find((i) => i.id === id) ?? null;
    },
    async findByIdForUpdate(id) {
      return store.instances.find((i) => i.id === id) ?? null;
    },
    async findByIdempotencyKey(definitionId, idempotencyKey) {
      return store.instances.find((i) => i.definitionId === definitionId && i.idempotencyKey === idempotencyKey) ?? null;
    },
    async list(filter) {
      return store.instances.filter((i) => {
        if (filter.status && i.status !== filter.status) return false;
        if (filter.subjectType && i.subjectType !== filter.subjectType) return false;
        if (filter.subjectId && i.subjectId !== filter.subjectId) return false;
        if (filter.legalEntityId && i.legalEntityId !== filter.legalEntityId) return false;
        if (filter.requesterUserId && i.requesterUserId !== filter.requesterUserId) return false;
        return true;
      });
    },
    async updateProgress(id, input) {
      const record = store.instances.find((i) => i.id === id);
      if (!record) throw new Error("Workflow instance not found.");
      const now = new Date().toISOString();
      record.status = input.status;
      if (input.currentStepId !== undefined) record.currentStepId = input.currentStepId;
      if (input.outcome !== undefined) record.outcome = input.outcome;
      if (input.failureCategory !== undefined) record.failureCategory = input.failureCategory;
      if (input.status === "COMPLETED") record.completedAt = now;
      if (input.status === "CANCELLED") record.cancelledAt = now;
      record.updatedAt = now;
      return record;
    },
  };
}
