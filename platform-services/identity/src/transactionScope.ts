/**
 * Transaction-scoped composition helper (PR #10) — mirrors platform-
 * services/hrms's composition/transactionScope.ts pattern exactly, one
 * layer up: builds an AccountSecurityService bound to an ALREADY-OPEN
 * transaction connection `tx`, never calling `.transaction()` again. The
 * external consumer is HRMS's identity-deactivation processor, which
 * needs to run `disableAccount()` on the SAME Postgres transaction as its
 * own request-row completion write — see docs/architecture/
 * identity-offboarding-revocation.md "Transaction boundary".
 */
import type { DatabaseProvider } from "../../../packages/shared/src/DatabaseProvider.ts";
import type { RbacService } from "./services/rbacService.ts";
import { createPgUserRepository } from "./repositories/postgres/pgUserRepository.ts";
import { createPgUserSecurityTransactionScoped } from "./repositories/postgres/pgUserSecurityTransaction.ts";
import { createAccountSecurityService, type AccountSecurityService } from "./services/accountSecurityService.ts";

export function createAccountSecurityServiceForTransaction(tx: DatabaseProvider, rbac: RbacService): AccountSecurityService {
  const users = createPgUserRepository(tx);
  return createAccountSecurityService({ users, rbac, transactions: createPgUserSecurityTransactionScoped(tx) });
}
