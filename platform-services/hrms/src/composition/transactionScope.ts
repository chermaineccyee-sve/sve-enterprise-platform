/**
 * Builds transaction-scoped HRMS lifecycle-completion services bound to a
 * Postgres transaction connection ALREADY opened by another package (PR
 * #9: a Workflow-triggered SYSTEM_ACTION handler's own transaction) — the
 * minimum transaction-aware port needed so HRMS's own authoritative case
 * completion (with all its own validation, RBAC, row-locking and audit
 * write) commits or rolls back as one unit together with the Workflow
 * decision that triggered it, and with Organisation's own authoritative
 * assignment mutation underneath it — without Workflow ever touching
 * hr_lifecycle_cases/employment_assignments directly and without HRMS or
 * Organisation knowing Workflow exists. See docs/architecture/
 * hrms-workflow-integration.md "Transaction boundary" and
 * platform-services/organisation/src/composition/transactionScope.ts for
 * the precedent this follows exactly one layer further up the stack.
 *
 * Every repository this touches (cases, events, milestones, reviews) —
 * AND Organisation's own scoped assignment service and audit write — is
 * bound to the SAME `tx` connection, so a rollback of the OUTER
 * (Workflow) transaction undoes all of it. `rbac` is deliberately NOT
 * re-bound, for the same reason Organisation's own transactionScope.ts
 * gives: it only reads pre-existing role/permission grants, never writes.
 */
import type { DatabaseProvider } from "../../../../packages/shared/src/DatabaseProvider.ts";
import type { RbacService } from "../../../identity/src/services/rbacService.ts";
import { createAuditService } from "../../../identity/src/services/auditService.ts";
import { createPgUserRepository } from "../../../identity/src/repositories/postgres/pgUserRepository.ts";
import { createPgOrganisationRepository } from "../../../identity/src/repositories/postgres/pgOrganisationRepository.ts";
import { createPgAuditRepository } from "../../../identity/src/repositories/postgres/pgAuditRepository.ts";
import { createEmploymentAssignmentServiceForTransaction } from "../../../organisation/src/composition/transactionScope.ts";
import { createPgLifecycleCaseRepository } from "../repositories/postgres/pgLifecycleCaseRepository.ts";
import { createPgLifecycleEventRepository } from "../repositories/postgres/pgLifecycleEventRepository.ts";
import { createPgLifecycleMilestoneRepository } from "../repositories/postgres/pgLifecycleMilestoneRepository.ts";
import { createPgProbationReviewRepository } from "../repositories/postgres/pgProbationReviewRepository.ts";
import { createPgLifecycleTransactionScoped } from "../repositories/postgres/pgLifecycleTransaction.ts";
import { createLifecycleCaseService, type LifecycleCaseService } from "../services/lifecycleCaseService.ts";
import { createEmploymentChangeService, type EmploymentChangeService } from "../services/employmentChangeService.ts";
import { createOffboardingService, type OffboardingService } from "../services/offboardingService.ts";

export function createLifecycleCaseServiceForTransaction(tx: DatabaseProvider, rbac: RbacService): LifecycleCaseService {
  const cases = createPgLifecycleCaseRepository(tx);
  const events = createPgLifecycleEventRepository(tx);
  const milestones = createPgLifecycleMilestoneRepository(tx);
  const organisation = createPgOrganisationRepository(tx);
  const users = createPgUserRepository(tx);
  const audit = createAuditService({ audit: createPgAuditRepository(tx) });
  const assignments = createEmploymentAssignmentServiceForTransaction(tx, rbac);

  return createLifecycleCaseService({
    cases,
    events,
    milestones,
    organisation,
    users,
    rbac,
    audit,
    transactions: createPgLifecycleTransactionScoped(tx),
    assignments,
    buildTransactionScopedAssignments: () => assignments,
  });
}

export function createEmploymentChangeServiceForTransaction(tx: DatabaseProvider, rbac: RbacService): EmploymentChangeService {
  return createEmploymentChangeService({ lifecycle: createLifecycleCaseServiceForTransaction(tx, rbac) });
}

export function createOffboardingServiceForTransaction(tx: DatabaseProvider, rbac: RbacService): OffboardingService {
  return createOffboardingService({ lifecycle: createLifecycleCaseServiceForTransaction(tx, rbac), users: createPgUserRepository(tx) });
}
