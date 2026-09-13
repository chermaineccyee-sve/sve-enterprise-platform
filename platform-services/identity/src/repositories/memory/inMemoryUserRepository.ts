import { randomUUID } from "node:crypto";
import type { UserRepository } from "../types.ts";
import type { InMemoryStore } from "./inMemoryStore.ts";
import type { AccountType, User, UserEmployeeLink } from "../../domain/entities.ts";
import type { PasswordHash } from "../../crypto/password.ts";

export function createInMemoryUserRepository(store: InMemoryStore): UserRepository {
  return {
    async createUser(input: { email: string; accountType: AccountType }): Promise<User> {
      const now = new Date().toISOString();
      const user: User = {
        id: randomUUID(),
        email: input.email.toLowerCase(),
        accountType: input.accountType,
        status: "active",
        createdAt: now,
        updatedAt: now,
      };
      store.users.push(user);
      return user;
    },
    async findByEmail(email: string): Promise<User | null> {
      return store.users.find((u) => u.email === email.toLowerCase()) ?? null;
    },
    async findById(id: string): Promise<User | null> {
      return store.users.find((u) => u.id === id) ?? null;
    },
    async findByIdForUpdate(id: string): Promise<User | null> {
      return store.users.find((u) => u.id === id) ?? null;
    },
    async setStatus(userId: string, status: "active" | "disabled"): Promise<void> {
      const user = store.users.find((u) => u.id === userId);
      if (user) {
        user.status = status;
        user.updatedAt = new Date().toISOString();
      }
    },
    async setCredential(userId: string, hash: PasswordHash): Promise<void> {
      store.credentials.set(userId, hash);
    },
    async getCredential(userId: string): Promise<PasswordHash | null> {
      return store.credentials.get(userId) ?? null;
    },
    async linkEmployee(link: { userId: string; employeeId: string; linkedBy: string }): Promise<UserEmployeeLink> {
      const full: UserEmployeeLink = { id: randomUUID(), ...link, linkedAt: new Date().toISOString(), unlinkedAt: null, unlinkedBy: null };
      store.employeeLinks.push(full);
      return full;
    },
    async findActiveLinkByUserId(userId: string): Promise<UserEmployeeLink | null> {
      return store.employeeLinks.find((l) => l.userId === userId && l.unlinkedAt === null) ?? null;
    },
    async findActiveLinkByEmployeeId(employeeId: string): Promise<UserEmployeeLink | null> {
      return store.employeeLinks.find((l) => l.employeeId === employeeId && l.unlinkedAt === null) ?? null;
    },
    async unlinkEmployee(linkId: string, unlinkedBy: string): Promise<void> {
      const link = store.employeeLinks.find((l) => l.id === linkId && l.unlinkedAt === null);
      if (link) {
        link.unlinkedAt = new Date().toISOString();
        link.unlinkedBy = unlinkedBy;
      }
    },
  };
}
