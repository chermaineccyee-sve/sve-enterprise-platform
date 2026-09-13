import { randomUUID } from "node:crypto";
import type { WorkflowStepRepository } from "../types.ts";
import type { InMemoryStore } from "./inMemoryStore.ts";
import type { WorkflowStep } from "../../domain/workflow.ts";

export function createInMemoryWorkflowStepRepository(store: InMemoryStore): WorkflowStepRepository {
  return {
    async create(versionId, input): Promise<WorkflowStep> {
      const now = new Date().toISOString();
      const record: WorkflowStep = {
        id: randomUUID(),
        versionId,
        sequenceNumber: input.sequenceNumber,
        stepType: input.stepType,
        name: input.name,
        assignmentMode: input.assignmentMode ?? null,
        assignedPermissionKey: input.assignedPermissionKey ?? null,
        assignedPermissionKeyPrivileged: input.assignedPermissionKeyPrivileged ?? null,
        allowSelfApproval: input.allowSelfApproval ?? false,
        permittedDecisions: input.permittedDecisions ?? null,
        systemActionHandlerKey: input.systemActionHandlerKey ?? null,
        dueAfterMinutes: input.dueAfterMinutes ?? null,
        escalateAfterMinutes: input.escalateAfterMinutes ?? null,
        escalationTargetMode: input.escalationTargetMode ?? "NONE",
        createdAt: now,
        updatedAt: now,
      };
      store.steps.push(record);
      return record;
    },
    async findById(id) {
      return store.steps.find((s) => s.id === id) ?? null;
    },
    async listByVersion(versionId) {
      return store.steps.filter((s) => s.versionId === versionId).sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    },
    async findBySequence(versionId, sequenceNumber) {
      return store.steps.find((s) => s.versionId === versionId && s.sequenceNumber === sequenceNumber) ?? null;
    },
    async update(id, input) {
      const record = store.steps.find((s) => s.id === id);
      if (!record) throw new Error("Workflow step not found.");
      Object.assign(record, input);
      record.updatedAt = new Date().toISOString();
      return record;
    },
    async delete(id) {
      const idx = store.steps.findIndex((s) => s.id === id);
      if (idx >= 0) store.steps.splice(idx, 1);
    },
  };
}
