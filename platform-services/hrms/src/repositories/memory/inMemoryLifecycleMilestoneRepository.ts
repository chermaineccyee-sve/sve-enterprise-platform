import { randomUUID } from "node:crypto";
import type { LifecycleMilestoneRepository } from "../types.ts";
import type { InMemoryStore } from "./inMemoryStore.ts";
import type { HrLifecycleMilestone, CreateMilestoneInput, MilestoneStatus } from "../../domain/lifecycle.ts";

export function createInMemoryLifecycleMilestoneRepository(store: InMemoryStore): LifecycleMilestoneRepository {
  return {
    async create(caseId: string, input: CreateMilestoneInput): Promise<HrLifecycleMilestone> {
      const now = new Date().toISOString();
      const record: HrLifecycleMilestone = {
        id: randomUUID(),
        caseId,
        milestoneType: input.milestoneType,
        status: "PENDING",
        dueDate: input.dueDate ?? null,
        completedAt: null,
        completedBy: null,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        createdAt: now,
        updatedAt: now,
      };
      store.milestones.push(record);
      return record;
    },
    async findById(id: string): Promise<HrLifecycleMilestone | null> {
      return store.milestones.find((m) => m.id === id) ?? null;
    },
    async listByCase(caseId: string): Promise<HrLifecycleMilestone[]> {
      return store.milestones.filter((m) => m.caseId === caseId);
    },
    async updateStatus(id: string, input: { status: MilestoneStatus; completedBy?: string | null; notes?: string | null }): Promise<HrLifecycleMilestone> {
      const record = store.milestones.find((m) => m.id === id);
      if (!record) throw new Error("Milestone not found.");
      record.status = input.status;
      record.completedAt = input.status === "COMPLETED" ? new Date().toISOString() : null;
      if (input.completedBy !== undefined) record.completedBy = input.completedBy;
      if (input.notes !== undefined) record.notes = input.notes;
      record.updatedAt = new Date().toISOString();
      return record;
    },
  };
}
