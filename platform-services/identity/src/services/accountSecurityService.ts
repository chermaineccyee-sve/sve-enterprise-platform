/**
 * Identity's own, generic account-disablement/re-enablement domain
 * operation (PR #10 — see docs/architecture/identity-offboarding-
 * revocation.md "Disable operation"). Not HRMS-specific: HRMS's own
 * offboarding integration calls this exactly like a manual administrative
 * caller would — see platform-services/hrms/src/integrations/
 * identityDeactivationProcessor.ts, the ONE file that imports this
 * service from outside this package.
 *
 * `disableAccount`/`enableAccount` run account-status change + session
 * revocation + security audit as ONE shared Postgres transaction
 * (`deps.transactions`, PR #10's UserSecurityTransaction) — never commit
 * "disabled" while a session revocation failed, and never commit a
 * partial write. Both are strongly idempotent: re-running against an
 * already-disabled/already-active account is a safe no-op (no duplicate
 * audit entry, no error).
 *
 * Gated by a single, flat, non-entity-scoped permission
 * (`identity.security.manage_account`) — this package has no employee/
 * legal-entity lookup of its own (only LegalEntity-level reads via
 * OrganisationRepository), so entity-scoped gating for a manual disable
 * is not cleanly buildable without a larger Identity/Organisation
 * integration this PR does not build. See the architecture doc's
 * "Remaining risks" for this explicitly accepted scope boundary — by the
 * time HRMS's automated integration ever calls this, entity/classification
 * authorisation has already happened upstream, at HRMS's own offboarding
 * completion (PR #9's execution-principal revalidation).
 */
import type { UserRepository, UserSecurityTransaction } from "../repositories/types.ts";
import type { RbacService } from "./rbacService.ts";
import { createAuditService } from "./auditService.ts";
import type { User } from "../domain/entities.ts";
import { ForbiddenError, NotFoundError } from "../domain/errors.ts";

export interface ActorContext {
  userId: string;
  email: string;
  ip?: string | null;
  userAgent?: string | null;
}

export const PERMISSIONS = {
  MANAGE_ACCOUNT: "identity.security.manage_account",
} as const;

/**
 * Attributes WHY/WHO/WHICH-SYSTEM without copying any confidential HR
 * termination detail into Identity's own audit trail (PR brief §19/§28) —
 * `reason` is a short, generic category (e.g. "hrms_offboarding"), never
 * free-text HR case content. `sourceSystem`/`sourceRequestId` are a plain
 * cross-reference, resolvable back to HRMS's own request row by whoever
 * is authorised to see it there — Identity itself stores only the
 * reference, never the underlying case.
 */
export interface AccountActionContext {
  reason: string;
  sourceSystem?: string | null;
  sourceRequestId?: string | null;
}

export interface AccountActionResult {
  user: User;
  sessionsRevoked: number;
  alreadyInState: boolean;
}

export function createAccountSecurityService(deps: { users: UserRepository; rbac: RbacService; transactions: UserSecurityTransaction }) {
  async function requireManageAccount(actor: ActorContext): Promise<void> {
    const access = await deps.rbac.authorize({ userId: actor.userId, permissionKey: PERMISSIONS.MANAGE_ACCOUNT });
    if (!access.allowed) throw new ForbiddenError(PERMISSIONS.MANAGE_ACCOUNT);
  }

  return {
    /**
     * Disables the target account, revokes every one of its active
     * sessions, and records ONE security audit entry — ALL in the SAME
     * transaction (`repos.audit`, bound to the same `tx` as the status
     * change and session revocation — PR brief §12: never commit
     * "disabled" while a session revocation failed, and never leave a
     * committed status change with no audit trail because a LATER step in
     * the same operation failed). Idempotent: an already-disabled target
     * is a no-op (never throws, never writes a second audit entry).
     */
    async disableAccount(actor: ActorContext, targetUserId: string, input: AccountActionContext): Promise<AccountActionResult> {
      await requireManageAccount(actor);

      return deps.transactions.run(async (repos) => {
        const locked = await repos.users.findByIdForUpdate(targetUserId);
        if (!locked) throw new NotFoundError("User");
        if (locked.status === "disabled") {
          return { user: locked, sessionsRevoked: 0, alreadyInState: true };
        }
        await repos.users.setStatus(targetUserId, "disabled");
        const sessionsRevoked = await repos.sessions.revokeAllForUser(targetUserId, "account_disabled");
        const updated = (await repos.users.findById(targetUserId))!;

        const audit = createAuditService({ audit: repos.audit });
        await audit.record({
          actorUserId: actor.userId,
          actorEmail: actor.email,
          action: "account.disabled",
          resourceType: "user",
          resourceId: targetUserId,
          changeBefore: { status: locked.status },
          changeAfter: { status: "disabled", sessionsRevoked, reason: input.reason, sourceSystem: input.sourceSystem ?? null, sourceRequestId: input.sourceRequestId ?? null },
          sourceIp: actor.ip,
          sourceUserAgent: actor.userAgent,
        });

        return { user: updated, sessionsRevoked, alreadyInState: false };
      });
    },

    /**
     * Re-enables the target account. Deliberately does NOT touch sessions
     * at all — every session this account ever had was already revoked
     * (by disableAccount, or otherwise) and stays revoked permanently; see
     * docs/architecture/identity-offboarding-revocation.md "Reactivation
     * boundary" — re-enabling never "un-revokes" a historical session, a
     * newly re-enabled account must authenticate fresh. Status change +
     * audit are the SAME shared transaction, for the identical reason as
     * disableAccount.
     */
    async enableAccount(actor: ActorContext, targetUserId: string, input: AccountActionContext): Promise<AccountActionResult> {
      await requireManageAccount(actor);

      return deps.transactions.run(async (repos) => {
        const locked = await repos.users.findByIdForUpdate(targetUserId);
        if (!locked) throw new NotFoundError("User");
        if (locked.status === "active") {
          return { user: locked, sessionsRevoked: 0, alreadyInState: true };
        }
        await repos.users.setStatus(targetUserId, "active");
        const updated = (await repos.users.findById(targetUserId))!;

        const audit = createAuditService({ audit: repos.audit });
        await audit.record({
          actorUserId: actor.userId,
          actorEmail: actor.email,
          action: "account.enabled",
          resourceType: "user",
          resourceId: targetUserId,
          changeBefore: { status: locked.status },
          changeAfter: { status: "active", reason: input.reason, sourceSystem: input.sourceSystem ?? null, sourceRequestId: input.sourceRequestId ?? null },
          sourceIp: actor.ip,
          sourceUserAgent: actor.userAgent,
        });

        return { user: updated, sessionsRevoked: 0, alreadyInState: false };
      });
    },
  };
}

export type AccountSecurityService = ReturnType<typeof createAccountSecurityService>;
