/**
 * This package's own composition root — mirrors platform-services/
 * organisation's exact pattern (which itself mirrors data-vault's):
 * HRMS depends on Identity's AND Organisation's contracts/services,
 * imported by source path; neither Identity nor Organisation has any
 * dependency on this package. See docs/architecture/
 * hrms-employee-lifecycle.md "Module ownership and dependency direction".
 *
 * No SVEGIP session-cookie bridge (same reasoning as Organisation): no
 * existing apps/svegip page authenticates against HRMS today.
 */
import type { DatabaseProvider } from "../../../../packages/shared/src/DatabaseProvider.ts";
import { createPgUserRepository } from "../../../identity/src/repositories/postgres/pgUserRepository.ts";
import { createPgOrganisationRepository } from "../../../identity/src/repositories/postgres/pgOrganisationRepository.ts";
import { createPgRbacRepository } from "../../../identity/src/repositories/postgres/pgRbacRepository.ts";
import { createPgSessionRepository } from "../../../identity/src/repositories/postgres/pgSessionRepository.ts";
import { createPgAuditRepository } from "../../../identity/src/repositories/postgres/pgAuditRepository.ts";
import { createSessionService, type SessionService } from "../../../identity/src/services/sessionService.ts";
import { createRbacService, type RbacService } from "../../../identity/src/services/rbacService.ts";
import { createAuditService, type AuditService } from "../../../identity/src/services/auditService.ts";
import type { UserRepository, OrganisationRepository } from "../../../identity/src/repositories/types.ts";
import { createOrganisationContainer, type OrganisationContainer } from "../../../organisation/src/composition/container.ts";
import { createPgLifecycleCaseRepository } from "../repositories/postgres/pgLifecycleCaseRepository.ts";
import { createPgLifecycleEventRepository } from "../repositories/postgres/pgLifecycleEventRepository.ts";
import { createPgLifecycleMilestoneRepository } from "../repositories/postgres/pgLifecycleMilestoneRepository.ts";
import { createPgProbationReviewRepository } from "../repositories/postgres/pgProbationReviewRepository.ts";
import { createPgLifecycleTransaction } from "../repositories/postgres/pgLifecycleTransaction.ts";
import { createLifecycleCaseService, type LifecycleCaseService } from "../services/lifecycleCaseService.ts";
import { createOnboardingService, type OnboardingService } from "../services/onboardingService.ts";
import { createProbationService, type ProbationService } from "../services/probationService.ts";
import { createEmploymentChangeService, type EmploymentChangeService } from "../services/employmentChangeService.ts";
import { createOffboardingService, type OffboardingService } from "../services/offboardingService.ts";

export interface HrmsContainer {
  users: UserRepository;
  organisation: OrganisationRepository;
  sessions: SessionService;
  rbac: RbacService;
  audit: AuditService;
  orgContainer: OrganisationContainer;
  lifecycle: LifecycleCaseService;
  onboarding: OnboardingService;
  probation: ProbationService;
  employmentChange: EmploymentChangeService;
  offboarding: OffboardingService;
}

export async function createHrmsContainer(db: DatabaseProvider): Promise<HrmsContainer> {
  const users = createPgUserRepository(db);
  const organisation = createPgOrganisationRepository(db);
  const rbacRepo = createPgRbacRepository(db);
  const sessionRepo = createPgSessionRepository(db);
  const auditRepo = createPgAuditRepository(db);

  const sessions = createSessionService({ sessions: sessionRepo });
  const rbac = createRbacService({ rbac: rbacRepo, organisation });
  const audit = createAuditService({ audit: auditRepo });

  // Organisation is consumed as a whole container (its own services,
  // already wired to Identity) — HRMS never reaches into Organisation's
  // repositories directly, only its service-level contracts
  // (assignments.createAssignment/endAssignment/isDirectManagerOf).
  const orgContainer = await createOrganisationContainer(db);

  const caseRepo = createPgLifecycleCaseRepository(db);
  const eventRepo = createPgLifecycleEventRepository(db);
  const milestoneRepo = createPgLifecycleMilestoneRepository(db);
  const reviewRepo = createPgProbationReviewRepository(db);
  const transactions = createPgLifecycleTransaction(db);

  const lifecycle = createLifecycleCaseService({
    cases: caseRepo,
    events: eventRepo,
    milestones: milestoneRepo,
    organisation,
    users,
    rbac,
    audit,
    transactions,
    assignments: orgContainer.assignments,
  });
  const onboarding = createOnboardingService({ lifecycle });
  const probation = createProbationService({ lifecycle, cases: caseRepo, reviews: reviewRepo, organisation, rbac, audit });
  const employmentChange = createEmploymentChangeService({ lifecycle, cases: caseRepo, organisation, rbac, orgAssignments: orgContainer.assignments });
  const offboarding = createOffboardingService({ lifecycle, cases: caseRepo, organisation, rbac, orgAssignments: orgContainer.assignments });

  return { users, organisation, sessions, rbac, audit, orgContainer, lifecycle, onboarding, probation, employmentChange, offboarding };
}
