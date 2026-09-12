import { randomUUID } from "node:crypto";
import type { MfaRepository } from "../types.ts";
import type { InMemoryStore } from "./inMemoryStore.ts";
import type { MfaMethod } from "../../domain/entities.ts";

export function createInMemoryMfaRepository(store: InMemoryStore): MfaRepository {
  return {
    async createMethod(input): Promise<MfaMethod> {
      const method: MfaMethod = {
        id: randomUUID(),
        userId: input.userId,
        methodType: "totp",
        secretEncrypted: input.secretEncrypted,
        status: "pending",
        createdAt: new Date().toISOString(),
        activatedAt: null,
        disabledAt: null,
        disabledBy: null,
      };
      store.mfaMethods.push(method);
      return method;
    },
    async findActiveOrPendingByUser(userId: string): Promise<MfaMethod | null> {
      return (
        store.mfaMethods.find((m) => m.userId === userId && (m.status === "active" || m.status === "pending")) ??
        null
      );
    },
    async activateMethod(id: string): Promise<void> {
      const method = store.mfaMethods.find((m) => m.id === id);
      if (method) {
        method.status = "active";
        method.activatedAt = new Date().toISOString();
      }
    },
    async disableMethod(id: string, disabledBy: string): Promise<void> {
      const method = store.mfaMethods.find((m) => m.id === id);
      if (method) {
        method.status = "disabled";
        method.disabledAt = new Date().toISOString();
        method.disabledBy = disabledBy;
      }
    },
    async replaceRecoveryCodes(input): Promise<void> {
      // Regenerating invalidates the previous set: remove all prior codes for this user.
      store.recoveryCodes = store.recoveryCodes.filter((c) => c.userId !== input.userId);
      const now = new Date().toISOString();
      for (const codeHash of input.codeHashes) {
        store.recoveryCodes.push({
          id: randomUUID(),
          userId: input.userId,
          generationId: input.generationId,
          codeHash,
          usedAt: null,
          createdAt: now,
        });
      }
    },
    async findUnusedRecoveryCodeByHash(userId: string, codeHash: string) {
      return (
        store.recoveryCodes.find((c) => c.userId === userId && c.codeHash === codeHash && c.usedAt === null) ?? null
      );
    },
    async markRecoveryCodeUsed(id: string): Promise<void> {
      const code = store.recoveryCodes.find((c) => c.id === id);
      if (code) code.usedAt = new Date().toISOString();
    },
  };
}
