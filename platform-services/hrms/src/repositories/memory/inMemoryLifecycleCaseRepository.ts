import { randomUUID } from "node:crypto";
import type { LifecycleCaseRepository } from "../types.ts";
import type { InMemoryStore } from "./inMemoryStore.ts";
import type { HrLifecycleCase, CreateLifecycleCaseInput, LifecycleCaseFilter, LifecycleStatus } from "../../domain/lifecycle.ts";

export function createInMemoryLifecycleCaseRepository(store: InMemoryStore): LifecycleCaseRepository {
  return {
    async create(input: CreateLifecycleCaseInput & { caseNumber: string; createdBy: string }): Promise<HrLifecycleCase> {
      const now = new Date().toISOString();
      const record: HrLifecycleCase = {
        id: randomUUID(),
        caseNumber: input.caseNumber,
        employeeId: input.employeeId,
        legalEntityId: input.legalEntityId,
        lifecycleType: input.lifecycleType,
        caseSubtype: input.caseSubtype ?? null,
        status: "DRAFT",
        currentStage: input.currentStage ?? null,
        initiatedAt: now,
        effectiveDate: input.effectiveDate ?? null,
        hrOwnerUserId: input.hrOwnerUserId,
        outcome: null,
        reasonCategory: input.reasonCategory ?? null,
        noticeDate: input.noticeDate ?? null,
        intendedLastWorkingDate: input.intendedLastWorkingDate ?? null,
        resultingAssignmentId: null,
        workflowInstanceId: null,
        pendingCompletionInput: null,
        createdBy: input.createdBy,
        updatedBy: input.createdBy,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        cancelledAt: null,
      };
      store.cases.push(record);
      return record;
    },
    async findById(id: string): Promise<HrLifecycleCase | null> {
      return store.cases.find((c) => c.id === id) ?? null;
    },
    /** No real concurrent transactions to lock against in-memory — behaves exactly like findById (see repositories/types.ts's interface doc). */
    async findByIdForUpdate(id: string): Promise<HrLifecycleCase | null> {
      return store.cases.find((c) => c.id === id) ?? null;
    },
    async list(filter: LifecycleCaseFilter): Promise<HrLifecycleCase[]> {
      return store.cases.filter((c) => {
        if (filter.employeeId && c.employeeId !== filter.employeeId) return false;
        if (filter.legalEntityId && c.legalEntityId !== filter.legalEntityId) return false;
        if (filter.lifecycleType && c.lifecycleType !== filter.lifecycleType) return false;
        if (filter.status && c.status !== filter.status) return false;
        return true;
      });
    },
    async updateStatus(
      id: string,
      input: {
        status: LifecycleStatus;
        currentStage?: string | null;
        outcome?: string | null;
        effectiveDate?: string | null;
        resultingAssignmentId?: string | null;
        pendingCompletionInput?: Record<string, unknown> | null;
        updatedBy: string;
      },
    ): Promise<HrLifecycleCase> {
      const record = store.cases.find((c) => c.id === id);
      if (!record) throw new Error("Lifecycle case not found.");
      record.status = input.status;
      if (input.currentStage !== undefined) record.currentStage = input.currentStage;
      if (input.outcome !== undefined) record.outcome = input.outcome;
      if (input.effectiveDate !== undefined) record.effectiveDate = input.effectiveDate;
      if (input.resultingAssignmentId !== undefined) record.resultingAssignmentId = input.resultingAssignmentId;
      if (input.pendingCompletionInput !== undefined) record.pendingCompletionInput = input.pendingCompletionInput;
      record.updatedBy = input.updatedBy;
      record.updatedAt = new Date().toISOString();
      if (input.status === "COMPLETED") record.completedAt = record.updatedAt;
      if (input.status === "CANCELLED") record.cancelledAt = record.updatedAt;
      return record;
    },
    async nextCaseNumberSeq(): Promise<number> {
      store.caseNumberSeq += 1;
      return store.caseNumberSeq;
    },
    async linkWorkflowInstance(id: string, workflowInstanceId: string): Promise<HrLifecycleCase> {
      const record = store.cases.find((c) => c.id === id);
      if (!record) throw new Error("Lifecycle case not found.");
      record.workflowInstanceId = workflowInstanceId;
      return record;
    },
  };
}
