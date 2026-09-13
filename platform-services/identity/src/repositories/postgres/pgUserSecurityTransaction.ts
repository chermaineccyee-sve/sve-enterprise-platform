/**
 * Real Postgres implementation of UserSecurityTransaction (PR #10) —
 * mirrors platform-services/hrms's pgLifecycleTransaction.ts exactly:
 * constructs user/session/audit repositories scoped to the SAME
 * transaction connection, so account status change + session revocation +
 * security audit commit or roll back together. Also exposes the raw `tx`
 * so an external caller (HRMS's identity-deactivation integration) can
 * bind its OWN transaction-scoped repositories to this exact connection —
 * never a second, nested DatabaseProvider.transaction() call — so
 * disabling the account and marking a deactivation request completed run
 * as one shared Postgres transaction. See docs/architecture/
 * identity-offboarding-revocation.md "Transaction boundary".
 */
import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { UserSecurityTransaction } from "../types.ts";
import { createPgUserRepository } from "./pgUserRepository.ts";
import { createPgSessionRepository } from "./pgSessionRepository.ts";
import { createPgAuditRepository } from "./pgAuditRepository.ts";

export function createPgUserSecurityTransaction(db: DatabaseProvider): UserSecurityTransaction {
  return {
    async run(fn) {
      return db.transaction(async (tx) => {
        return fn({ users: createPgUserRepository(tx), sessions: createPgSessionRepository(tx), audit: createPgAuditRepository(tx) }, tx);
      });
    },
  };
}

/**
 * Same behaviour, for use when the caller has ALREADY opened the Postgres
 * transaction `tx` belongs to (e.g. HRMS's deactivation-request processor
 * running its own request-row update on the same connection). Never calls
 * `tx.transaction()` again — runs `fn` directly against `tx`, joining
 * whatever outer transaction is already open. Mirrors
 * createPgLifecycleTransactionScoped exactly.
 */
export function createPgUserSecurityTransactionScoped(tx: DatabaseProvider): UserSecurityTransaction {
  return {
    async run(fn) {
      return fn({ users: createPgUserRepository(tx), sessions: createPgSessionRepository(tx), audit: createPgAuditRepository(tx) }, tx);
    },
  };
}
