/**
 * This package's own composition root — mirrors platform-services/
 * organisation's exact pattern (which itself mirrors data-vault's):
 * HRMS depends on Identity's AND Organisation's contracts/services,
 * imported by source path; neither Identity nor Organisation has any
 * dependency on this package. See docs/architecture/
 * hrms-employee-lifecycle.md "Module ownership and dependency direction".
 *
 * PR #11: the SVEGIP session-cookie bridge is now wired here, following
 * Organisation's own newly-added wiring exactly (which itself mirrors
 * Data Vault's already-accepted model) — apps/svegip's new People/HRMS
 * area calls into this service's HTTP API via its own Netlify proxy
 * function. See docs/architecture/hrms-application-shell.md.
 */
import type { DatabaseProvider } from "../../../../packages/shared/src/DatabaseProvider.ts";
import type { SecretsProvider } from "../../../../packages/security/src/SecretsProvider.ts";
import { createEnvSecretsProvider } from "../../../identity/src/config/envSecretsProvider.ts";
import { loadSvegipBridgeSecret } from "../../../identity/src/services/svegipSessionBridge.ts";
import { loadTrustedOrigins } from "../config/trustedOrigins.ts";
import { createPgUserRepository } from "../../../identity/src/repositories/postgres/pgUserRepository.ts";
import { createPgOrganisationRepository } from "../../../identity/src/repositories/postgres/pgOrganisationRepository.ts";
import { createPgRbacRepository } from "../../../identity/src/repositories/postgres/pgRbacRepository.ts";
import { createPgSessionRepository } from "../../../identity/src/repositories/postgres/pgSessionRepository.ts";
import { createPgAuditRepository } from "../../../identity/src/repositories/postgres/pgAuditRepository.ts";
import { createSessionService, type SessionService } from "../../../identity/src/services/sessionService.ts";
import { createPgUserSecurityTransaction } from "../../../identity/src/repositories/postgres/pgUserSecurityTransaction.ts";
import { createRbacService, type RbacService } from "../../../identity/src/services/rbacService.ts";
import { createAuditService, type AuditService } from "../../../identity/src/services/auditService.ts";
import type { UserRepository, OrganisationRepository } from "../../../identity/src/repositories/types.ts";
import { createOrganisationContainer, type OrganisationContainer } from "../../../organisation/src/composition/container.ts";
import { createEmploymentAssignmentServiceForTransaction } from "../../../organisation/src/composition/transactionScope.ts";
import { createWorkflowContainer, type WorkflowContainer } from "../../../workflow/src/composition/container.ts";
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
import { createApprovalService, type ApprovalService } from "../services/approvalService.ts";
import { createHrmsWorkflowIntegration } from "../integrations/workflowIntegration.ts";
import { createIdentityDeactivationProcessor, type IdentityDeactivationProcessor } from "../integrations/identityDeactivationProcessor.ts";

export interface HrmsContainer {
  users: UserRepository;
  organisation: OrganisationRepository;
  sessions: SessionService;
  rbac: RbacService;
  audit: AuditService;
  orgContainer: OrganisationContainer;
  /**
   * The full Workflow container, sharing this SAME `db` — HRMS is the
   * only package that ever imports it (PR #9). Exposed here mainly so
   * the composition root and the installHrmsWorkflowDefinitions bootstrap
   * script can reach `workflow.definitions`/`workflow.instances` directly;
   * approvalService itself never sees this — only the narrow
   * WorkflowSubmissionPort (see services/workflowPort.ts).
   */
  workflow: WorkflowContainer;
  lifecycle: LifecycleCaseService;
  onboarding: OnboardingService;
  probation: ProbationService;
  employmentChange: EmploymentChangeService;
  offboarding: OffboardingService;
  approval: ApprovalService;
  /**
   * PR #10: the one HRMS-side capability that calls INTO Identity's
   * accountSecurityService — see integrations/identityDeactivationProcessor.ts.
   * Identity remains entirely unaware this container/table exists.
   */
  identityDeactivation: IdentityDeactivationProcessor;
  /** Null when the transitional SVEGIP bridge is not configured for this deployment — see identity/src/services/svegipSessionBridge.ts. */
  svegipBridgeSecret: string | null;
  /** Origins trusted for cookie-authenticated state-changing requests — see config/trustedOrigins.ts. */
  trustedOrigins: Set<string>;
}

export async function createHrmsContainer(db: DatabaseProvider, opts?: { secrets?: SecretsProvider }): Promise<HrmsContainer> {
  const secrets = opts?.secrets ?? createEnvSecretsProvider();
  const users = createPgUserRepository(db);
  const organisation = createPgOrganisationRepository(db);
  const rbacRepo = createPgRbacRepository(db);
  const sessionRepo = createPgSessionRepository(db);
  const auditRepo = createPgAuditRepository(db);

  const sessions = createSessionService({ sessions: sessionRepo, users, transactions: createPgUserSecurityTransaction(db) });
  const rbac = createRbacService({ rbac: rbacRepo, organisation, users });
  const audit = createAuditService({ audit: auditRepo });

  // Organisation is consumed as a whole container (its own services,
  // already wired to Identity) — HRMS never reaches into Organisation's
  // repositories directly, only its service-level contracts
  // (assignments.createAssignment/endAssignment/isDirectManagerOf).
  const orgContainer = await createOrganisationContainer(db);

  // Workflow is consumed as a whole container, sharing this SAME `db` —
  // required so a registered SYSTEM_ACTION handler's own writes join the
  // exact same Postgres transaction as the Workflow decision that
  // triggered it (see composition/transactionScope.ts and docs/
  // architecture/hrms-workflow-integration.md "Transaction boundary").
  // Workflow's own composition root/tests remain entirely unaware this
  // container exists — HRMS is the only importer.
  const workflow = await createWorkflowContainer(db);

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
    // Employment-change/offboarding completion binds Organisation's own
    // authoritative assignment mutation to the SAME Postgres transaction
    // as HRMS's own case-completion write — see
    // createEmploymentAssignmentServiceForTransaction's header and docs/
    // architecture/hrms-employee-lifecycle.md "Transaction boundaries".
    buildTransactionScopedAssignments: (tx) => createEmploymentAssignmentServiceForTransaction(tx, rbac),
  });
  const onboarding = createOnboardingService({ lifecycle });
  const probation = createProbationService({ lifecycle, cases: caseRepo, reviews: reviewRepo, organisation, rbac, audit });
  const employmentChange = createEmploymentChangeService({ lifecycle });
  const offboarding = createOffboardingService({ lifecycle, users });

  // Registers the two SYSTEM_ACTION completion handlers into `workflow`'s
  // OWN registry and returns the narrow port approvalService depends on
  // — see integrations/workflowIntegration.ts's header for why this is
  // the one place HRMS -> Workflow's concrete dependency edge exists.
  const workflowPort = createHrmsWorkflowIntegration({ workflow, rbac });
  const approval = createApprovalService({ cases: caseRepo, organisation, rbac, audit, transactions, lifecycle, workflow: workflowPort });

  // PR #10: the ONE place HRMS -> Identity's accountSecurityService
  // dependency edge exists — see integrations/identityDeactivationProcessor.ts.
  const identityDeactivation = createIdentityDeactivationProcessor({ db, rbac });

  const svegipBridgeSecret = await loadSvegipBridgeSecret(secrets);
  const trustedOrigins = loadTrustedOrigins();

  return { users, organisation, sessions, rbac, audit, orgContainer, workflow, lifecycle, onboarding, probation, employmentChange, offboarding, approval, identityDeactivation, svegipBridgeSecret, trustedOrigins };
}
