/**
 * The identity-deactivation processor (PR #10) — the ONE file, alongside
 * integrations/workflowIntegration.ts, that imports something outside
 * HRMS's own domain: platform-services/identity's generic
 * accountSecurityService. Identity itself has NO knowledge this file, or
 * HRMS's own hr_identity_deactivation_requests table, exist — the
 * dependency edge runs one way, exactly like PR #9's HRMS -> Workflow
 * integration.
 *
 * Consumes the durable request row offboardingService's own completion
 * write creates (see services/offboardingService.ts's additionalWrites)
 * — never polls hr_lifecycle_events directly, never a generic event bus.
 * Each attempt is ONE shared Postgres transaction spanning BOTH the
 * request-row lock/completion write (HRMS's own LifecycleTransaction) AND
 * Identity's disableAccount() (bound to the SAME `tx` via
 * createAccountSecurityServiceForTransaction) — see docs/architecture/
 * identity-offboarding-revocation.md "Transaction boundary" for why this
 * is safe to do here (unlike PR #9's HRMS/Organisation/Workflow
 * completion, which deliberately does NOT extend to include Identity —
 * this file IS that deliberate, later, independent processing step).
 */
import type { DatabaseProvider } from "../../../../packages/shared/src/DatabaseProvider.ts";
import type { RbacService } from "../../../identity/src/services/rbacService.ts";
import type { ActorContext as IdentityActorContext } from "../../../identity/src/services/accountSecurityService.ts";
import { createAccountSecurityServiceForTransaction } from "../../../identity/src/transactionScope.ts";
import { createPgLifecycleTransaction } from "../repositories/postgres/pgLifecycleTransaction.ts";
import { createPgIdentityDeactivationRequestRepository } from "../repositories/postgres/pgIdentityDeactivationRequestRepository.ts";
import { NotFoundError } from "../domain/errors.ts";

export type DeactivationProcessOutcome = "completed" | "already_completed" | "failed";

export interface DeactivationProcessResult {
  requestId: string;
  outcome: DeactivationProcessOutcome;
}

export function createIdentityDeactivationProcessor(deps: { db: DatabaseProvider; rbac: RbacService }) {
  const transactions = createPgLifecycleTransaction(deps.db);
  const readOnlyRequests = createPgIdentityDeactivationRequestRepository(deps.db);

  /**
   * Processes exactly one request. Strongly idempotent: a request already
   * COMPLETED is a safe no-op (never re-disables, never re-audits — see
   * accountSecurityService.disableAccount's own idempotency). Concurrent
   * callers processing the SAME request serialize on the request row's
   * `FOR UPDATE` lock (Race A) — only one can ever observe
   * status==='REQUESTED' and proceed to disable+markCompleted.
   */
  async function processOne(systemActor: IdentityActorContext, requestId: string): Promise<DeactivationProcessResult> {
    try {
      const outcome = await transactions.run(async (repos, tx) => {
        const request = await repos.deactivationRequests.findByIdForUpdate(requestId);
        if (!request) throw new NotFoundError("Identity deactivation request");
        if (request.status === "COMPLETED") return "already_completed" as const;

        // Re-verify current employment state (PR brief §14) — the case
        // must still show COMPLETED. This foundation has no mechanism
        // that ever reverses a completed offboarding, so this is a
        // defensive check, not a normal-path branch.
        const hrCase = await repos.cases.findById(request.caseId);
        if (!hrCase || hrCase.status !== "COMPLETED") {
          throw new Error(`request ${requestId} references case ${request.caseId}, which is not (or no longer) COMPLETED`);
        }

        const accountSecurity = createAccountSecurityServiceForTransaction(tx, deps.rbac);
        await accountSecurity.disableAccount(systemActor, request.targetUserId, {
          reason: request.reasonCategory,
          sourceSystem: "hrms-offboarding",
          sourceRequestId: request.id,
        });
        await repos.deactivationRequests.markCompleted(request.id);
        return "completed" as const;
      });
      return { requestId, outcome };
    } catch (error) {
      // The attempt above rolled back IN FULL (per the brief's own
      // invariant: never claim completion, or leave a partial state, when
      // any step failed) — nothing from it persists. This is a SEPARATE,
      // subsequent transaction whose only job is to leave a durable,
      // non-sensitive breadcrumb for the next retry/operator, never HR
      // case content.
      // Records failureReason/attemptCount/lastAttemptedAt as METADATA
      // only — the row's status stays "REQUESTED", so it remains inside
      // processAllPending()'s own listByStatus("REQUESTED") sweep with no
      // separate retry path. This is the fix for the bug where a request
      // that failed once would be excluded from every future
      // processAllPending() call (it used to move to a terminal "FAILED"
      // status nothing ever re-selected), permanently leaving the target
      // account active. See docs/architecture/
      // identity-offboarding-revocation.md "Retries / idempotency".
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
      await transactions.run(async (repos) => {
        const current = await repos.deactivationRequests.findById(requestId);
        if (current && current.status === "REQUESTED") {
          await repos.deactivationRequests.recordFailedAttempt(requestId, message);
        }
      });
      return { requestId, outcome: "failed" };
    }
  }

  return {
    processOne,
    /**
     * Processes every currently-REQUESTED row, oldest first. A plain,
     * non-transactional read (never a materialised queue/worker-lease
     * mechanism) — safe to call repeatedly/concurrently from more than
     * one process, since each individual request's own processing is
     * independently transactional and idempotent.
     */
    async processAllPending(systemActor: IdentityActorContext): Promise<DeactivationProcessResult[]> {
      const pending = await readOnlyRequests.listByStatus("REQUESTED");
      const results: DeactivationProcessResult[] = [];
      for (const request of pending) {
        results.push(await processOne(systemActor, request.id));
      }
      return results;
    },
  };
}

export type IdentityDeactivationProcessor = ReturnType<typeof createIdentityDeactivationProcessor>;
