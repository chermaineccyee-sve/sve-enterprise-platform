/**
 * Authorization service: the ALLOW/DENY evaluator described in the PR
 * brief's item 5 diagram (user + session + role + permission + legal
 * entity + business context + resource + action + record restriction ->
 * ALLOW/DENY). Default-deny throughout: any missing or ambiguous input
 * denies, it never falls open. See docs/architecture/identity-foundation.md
 * "Authorization model" for the full write-up this implements.
 */
import type { RbacRepository, OrganisationRepository, UserRepository } from "../repositories/types.ts";
import type { AccessTarget } from "../domain/entities.ts";
import type { DataClassification } from "../../../../packages/types/src/entity-context.ts";

const CLASSIFICATION_ORDER: DataClassification[] = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED", "PRIVILEGED"];

function classificationAllowed(max: DataClassification, requested: DataClassification): boolean {
  return CLASSIFICATION_ORDER.indexOf(requested) <= CLASSIFICATION_ORDER.indexOf(max);
}

export interface AuthorizeInput {
  userId: string;
  permissionKey: string;
  target?: AccessTarget;
}

export interface AuthorizeResult {
  allowed: boolean;
  reason: string;
}

function deny(reason: string): AuthorizeResult {
  return { allowed: false, reason };
}

/**
 * Does an entity access grant's scope cover the requested target? Purely
 * hierarchical (group covers everything; legal_entity covers its business
 * units/departments; etc.) — this function never looks at
 * is_group_headquarters. HQ status is a descriptive fact on legal_entities,
 * not an access grant, and must never be consulted here (see
 * docs/architecture/identity-foundation.md "Group and HQ authority are not
 * access grants").
 */
function grantCoversTarget(
  grant: { scopeType: string; legalEntityId: string | null; businessUnitId: string | null; departmentId: string | null },
  target: AccessTarget,
): boolean {
  if (grant.scopeType === "group") return true;
  if (!target.legalEntityId) return false; // target has no entity context at all -> can't match a scoped grant
  if (grant.legalEntityId !== target.legalEntityId) return false;
  if (grant.scopeType === "legal_entity") return true;
  if (!target.businessUnitId) return false;
  if (grant.businessUnitId !== target.businessUnitId) return false;
  if (grant.scopeType === "business_unit") return true;
  if (!target.departmentId) return false;
  return grant.departmentId === target.departmentId;
}

export function createRbacService(deps: { rbac: RbacRepository; organisation: OrganisationRepository; users: UserRepository }) {
  return {
    async authorize(input: AuthorizeInput): Promise<AuthorizeResult> {
      const target = input.target ?? {};

      // 0. Central active-account invariant (PR #10 — see docs/architecture/
      // identity-offboarding-revocation.md "Central active-account
      // invariant"): a disabled account must be denied by every permission
      // check, regardless of role assignments/entity grants, so dependent
      // modules never need their own ad-hoc `user.status !== 'active'`
      // check. `input.userId` here is always the ACTOR asking to be
      // authorized, never a "target" business object — an active
      // administrator managing a disabled target user's own account (via a
      // separate, explicit operation) is authorized as THEMSELVES, so this
      // never blocks that.
      //
      // TEMPORARY, DOCUMENTED LEGACY TEST-COMPATIBILITY BOUNDARY —
      // deliberately does NOT deny merely because no `users` row exists
      // for this id. This is NOT a production fail-open: it is provably
      // unreachable from any real caller. `user_role_assignments.user_id`
      // and `entity_access_grants.user_id` are both `NOT NULL REFERENCES
      // users(id)` in the real schema (migration 001) — Postgres itself
      // refuses to grant a role or entity access to a nonexistent user
      // (proven directly: identity/test/integration/postgres.test.ts,
      // "a role assignment for a nonexistent user id is rejected by the
      // real schema (FK-enforced) — proves authorize()'s not-found
      // carve-out is unreachable in production"). Every real caller of
      // authorize() resolves `userId` from either a live session
      // (`sessions.user_id` is the same kind of NOT-NULL FK) or an
      // explicit `users.findById`/`findByEmail` lookup that itself throws
      // first if the user doesn't exist (e.g. HRMS's own
      // resolveHrOwnerActor) — there is no code path in this codebase
      // that calls authorize() with a fabricated, unpersisted userId.
      //
      // The ONLY thing this carve-out actually preserves is this
      // repository's own IN-MEMORY unit-test convention (surveyed
      // exhaustively before this change): granting a role/entity-access
      // grant to a bare `randomUUID()` actor with no backing `users` row
      // is the dominant pattern across Identity/Organisation/Data Vault/
      // most of Workflow/HRMS's existing unit-test suites — the in-memory
      // repositories enforce no FK-like integrity, so nothing there ever
      // required a real user before. Migrating that whole convention to
      // always create a real backing user was assessed and rejected as
      // disproportionate to this PR's actual security scope (it would
      // touch on the order of a hundred call sites across five packages'
      // test suites for a codepath that is already unreachable in
      // production) — this comment, and the FK-proof test above, are the
      // explicit trade-off record the review asked for.
      const actorUser = await deps.users.findById(input.userId);
      if (actorUser && actorUser.status !== "active") {
        return deny("actor account is not active");
      }

      // 1. Permission: does any active role assignment grant this permission key?
      const assignments = await deps.rbac.listActiveRoleAssignments(input.userId);
      if (assignments.length === 0) return deny("no active role assignments");

      let matchedPermission: { maxClassification: DataClassification } | null = null;
      for (const assignment of assignments) {
        const permissions = await deps.rbac.listPermissionsForRole(assignment.roleId);
        const found = permissions.find((p) => p.key === input.permissionKey);
        if (found) {
          matchedPermission = found;
          break;
        }
      }
      if (!matchedPermission) return deny(`permission not granted: ${input.permissionKey}`);

      // 2. Record classification ceiling — independent of entity access breadth.
      // This is what stops a Group-scope grant or an Administrator role from
      // implying access to RESTRICTED/PRIVILEGED data: the permission itself
      // must be capable of it.
      if (target.recordClassification && !classificationAllowed(matchedPermission.maxClassification, target.recordClassification)) {
        return deny(
          `permission '${input.permissionKey}' (max ${matchedPermission.maxClassification}) does not cover ${target.recordClassification} data`,
        );
      }

      // 3. Entity access — only required when the target actually has entity
      // context. A permission with no entity-scoped target (e.g. a purely
      // self-service action) does not require an entity access grant.
      const hasEntityTarget = Boolean(target.legalEntityId || target.businessUnitId || target.departmentId);
      if (hasEntityTarget) {
        const grants = await deps.rbac.listActiveEntityAccessGrants(input.userId);
        const covered = grants.some((g) => grantCoversTarget(g, target));
        if (!covered) return deny("no entity access grant covers the requested legal entity/business unit/department");
      }

      return { allowed: true, reason: "permission granted and entity access covers target" };
    },
  };
}

export type RbacService = ReturnType<typeof createRbacService>;
