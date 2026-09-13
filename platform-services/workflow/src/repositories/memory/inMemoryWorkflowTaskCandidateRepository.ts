import { randomUUID } from "node:crypto";
import type { WorkflowTaskCandidateRepository } from "../types.ts";
import type { InMemoryStore } from "./inMemoryStore.ts";

export function createInMemoryWorkflowTaskCandidateRepository(store: InMemoryStore): WorkflowTaskCandidateRepository {
  return {
    async recordCandidates(taskId, userIds) {
      const now = new Date().toISOString();
      for (const userId of userIds) {
        store.taskCandidates.push({ id: randomUUID(), taskId, userId, createdAt: now });
      }
    },
    async isCandidate(taskId, userId) {
      return store.taskCandidates.some((c) => c.taskId === taskId && c.userId === userId);
    },
    async listCandidateUserIds(taskId) {
      return store.taskCandidates.filter((c) => c.taskId === taskId).map((c) => c.userId);
    },
    async listByTask(taskId) {
      return store.taskCandidates.filter((c) => c.taskId === taskId);
    },
  };
}
