import { randomUUID } from "node:crypto";
import type { WorkflowTaskRepository } from "../types.ts";
import type { InMemoryStore } from "./inMemoryStore.ts";
import type { WorkflowTask } from "../../domain/workflow.ts";

export function createInMemoryWorkflowTaskRepository(store: InMemoryStore): WorkflowTaskRepository {
  return {
    async create(input): Promise<WorkflowTask> {
      const now = new Date().toISOString();
      const record: WorkflowTask = {
        id: randomUUID(),
        instanceId: input.instanceId,
        stepId: input.stepId,
        taskType: input.taskType,
        assignmentMode: input.assignmentMode,
        assignedUserId: input.assignedUserId ?? null,
        assignedPermissionKey: input.assignedPermissionKey ?? null,
        status: "PENDING",
        dueAt: input.dueAt ?? null,
        escalateAfter: input.escalateAfter ?? null,
        escalatedAt: null,
        escalationTargetMode: input.escalationTargetMode,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        completedBy: null,
        cancelledAt: null,
      };
      store.tasks.push(record);
      return record;
    },
    async findById(id) {
      return store.tasks.find((t) => t.id === id) ?? null;
    },
    async listByInstance(instanceId) {
      return store.tasks.filter((t) => t.instanceId === instanceId);
    },
    async listCandidatesForUser(userId, filter) {
      return store.tasks.filter((t) => {
        if (filter.instanceId && t.instanceId !== filter.instanceId) return false;
        if (filter.status && t.status !== filter.status) return false;
        return t.assignedUserId === userId || t.assignmentMode === "ROLE";
      });
    },
    async transitionStatus(id, expectedStatus, input) {
      const record = store.tasks.find((t) => t.id === id);
      if (!record || record.status !== expectedStatus) return null;
      const now = new Date().toISOString();
      record.status = input.status;
      if (input.status === "COMPLETED") {
        record.completedAt = now;
        record.completedBy = input.completedBy ?? null;
      }
      if (input.status === "CANCELLED") record.cancelledAt = now;
      record.updatedAt = now;
      return record;
    },
    async markEscalated(id, input) {
      const record = store.tasks.find((t) => t.id === id);
      if (!record || record.escalatedAt !== null) return null;
      record.escalatedAt = new Date().toISOString();
      if (input.assignedUserId !== undefined) record.assignedUserId = input.assignedUserId;
      record.updatedAt = new Date().toISOString();
      return record;
    },
    async reassign(id, input) {
      const record = store.tasks.find((t) => t.id === id);
      if (!record) throw new Error("Workflow task not found.");
      record.assignedUserId = input.assignedUserId;
      record.updatedAt = new Date().toISOString();
      return record;
    },
    async listDueForEscalation(now) {
      return store.tasks.filter((t) => t.status === "PENDING" && t.escalatedAt === null && t.escalateAfter !== null && t.escalateAfter <= now);
    },
  };
}
