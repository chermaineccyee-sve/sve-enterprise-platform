import { randomUUID } from "node:crypto";
import type { HrIdentityDeactivationRequestRepository } from "../types.ts";
import type { InMemoryStore } from "./inMemoryStore.ts";
import type { HrIdentityDeactivationRequest, DeactivationRequestStatus } from "../../domain/lifecycle.ts";

export function createInMemoryIdentityDeactivationRequestRepository(store: InMemoryStore): HrIdentityDeactivationRequestRepository {
  return {
    async create(input): Promise<HrIdentityDeactivationRequest> {
      const now = new Date().toISOString();
      const request: HrIdentityDeactivationRequest = {
        id: randomUUID(),
        caseId: input.caseId,
        employeeId: input.employeeId,
        targetUserId: input.targetUserId,
        requestedBy: input.requestedBy,
        reasonCategory: input.reasonCategory ?? "hrms_offboarding",
        status: "REQUESTED",
        requestedAt: now,
        completedAt: null,
        failureReason: null,
        attemptCount: 0,
        lastAttemptedAt: null,
      };
      store.deactivationRequests.push(request);
      return request;
    },
    async findById(id: string): Promise<HrIdentityDeactivationRequest | null> {
      return store.deactivationRequests.find((r) => r.id === id) ?? null;
    },
    async findByIdForUpdate(id: string): Promise<HrIdentityDeactivationRequest | null> {
      return store.deactivationRequests.find((r) => r.id === id) ?? null;
    },
    async findByCaseId(caseId: string): Promise<HrIdentityDeactivationRequest | null> {
      const matches = store.deactivationRequests.filter((r) => r.caseId === caseId);
      return matches[matches.length - 1] ?? null;
    },
    async listByStatus(status: DeactivationRequestStatus): Promise<HrIdentityDeactivationRequest[]> {
      return store.deactivationRequests.filter((r) => r.status === status);
    },
    async markCompleted(id: string): Promise<HrIdentityDeactivationRequest> {
      const request = store.deactivationRequests.find((r) => r.id === id);
      if (!request) throw new Error("Identity deactivation request not found");
      const now = new Date().toISOString();
      request.status = "COMPLETED";
      request.completedAt = now;
      request.attemptCount += 1;
      request.lastAttemptedAt = now;
      return request;
    },
    async recordFailedAttempt(id: string, failureReason: string): Promise<HrIdentityDeactivationRequest> {
      const request = store.deactivationRequests.find((r) => r.id === id);
      if (!request) throw new Error("Identity deactivation request not found");
      request.failureReason = failureReason;
      request.attemptCount += 1;
      request.lastAttemptedAt = new Date().toISOString();
      return request;
    },
  };
}
