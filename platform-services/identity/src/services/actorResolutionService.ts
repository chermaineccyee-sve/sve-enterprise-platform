/**
 * Resolves the set of currently eligible actors for a permission +
 * target, reusing (never re-implementing) `RbacService.authorize()`'s
 * classification-ceiling and entity-access-grant logic for each
 * candidate. Identity remains authoritative for roles and access: this
 * is the safe, reusable actor-resolution capability other packages
 * should depend on instead of querying Identity's tables directly for
 * "who can act on this" questions — see
 * platform-services/workflow's ROLE-mode routing, this service's first
 * consumer, and docs/architecture/identity-foundation.md "Actor
 * resolution".
 *
 * A separate factory (not a method added to `createRbacService`) so
 * every existing `createRbacService({rbac, organisation})` call site
 * across the codebase is unaffected — this composes an already-built
 * `RbacService` instance rather than widening its constructor.
 */
import type { RbacRepository, UserRepository } from "../repositories/types.ts";
import type { RbacService } from "./rbacService.ts";
import type { AccessTarget } from "../domain/entities.ts";

export function createActorResolutionService(deps: { rbac: RbacRepository; rbacService: RbacService; users: UserRepository }) {
  return {
    /**
     * Every userId that currently: holds an active role assignment
     * granting `permissionKey`; passes that permission's classification
     * ceiling for `target.recordClassification`; passes entity-access-
     * grant coverage for `target`; AND has an `active` (not `disabled`)
     * account. Never a distributed/materialised cache — recomputed live
     * from Identity's own authoritative tables on every call, so it
     * always reflects the CURRENT role/grant state at the moment it is
     * called (callers that need historical stability, e.g. a workflow
     * task's resolved candidate set, must persist the result themselves
     * at the moment they call this — see platform-services/workflow's
     * `workflow_task_candidates`).
     */
    async listEligibleActors(permissionKey: string, target: AccessTarget): Promise<string[]> {
      const candidateIds = await deps.rbac.listActiveUserIdsForPermission(permissionKey);
      const eligible: string[] = [];
      for (const userId of candidateIds) {
        const user = await deps.users.findById(userId);
        if (!user || user.status !== "active") continue;
        const result = await deps.rbacService.authorize({ userId, permissionKey, target });
        if (result.allowed) eligible.push(userId);
      }
      return eligible;
    },
  };
}

export type ActorResolutionService = ReturnType<typeof createActorResolutionService>;
