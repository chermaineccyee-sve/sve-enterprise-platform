/**
 * The ONE file in this package that imports platform-services/workflow —
 * the concrete HRMS -> Workflow dependency edge PR #9 introduces. Workflow
 * itself imports nothing from HRMS (see platform-services/workflow's own
 * composition root, unchanged) — this file is where a business domain
 * "plugs into" the generic orchestration engine, exactly as
 * docs/architecture/workflow-approval-foundation.md's domain boundary
 * always intended. HRMS's own service layer (approvalService.ts) stays
 * blind to Workflow's concrete types, depending only on
 * WorkflowSubmissionPort (see workflowPort.ts) — this file is the ONE
 * concrete adapter implementing that port, plus the two registered
 * SYSTEM_ACTION completion handlers and the idempotent definition
 * bootstrap. See docs/architecture/hrms-workflow-integration.md
 * "Integration/composition boundary".
 */
import type { WorkflowContainer } from "../../../workflow/src/composition/container.ts";
import type { SystemActionContext } from "../../../workflow/src/domain/systemActionRegistry.ts";
import { NotFoundError as WorkflowNotFoundError } from "../../../workflow/src/domain/errors.ts";
import { createPgUserRepository } from "../../../identity/src/repositories/postgres/pgUserRepository.ts";
import { createPgLifecycleCaseRepository } from "../repositories/postgres/pgLifecycleCaseRepository.ts";
import { createEmploymentChangeServiceForTransaction, createOffboardingServiceForTransaction } from "../composition/transactionScope.ts";
import type { RbacService } from "../../../identity/src/services/rbacService.ts";
import type { CreateAssignmentInput } from "../../../organisation/src/domain/employee.ts";
import type { ActorContext } from "../services/access.ts";
import type { WorkflowSubmissionPort, WorkflowStatusResult } from "../services/workflowPort.ts";
import { DEFINITION_KEY_BY_TYPE } from "../services/approvalService.ts";

/** Registered handler keys — never executable code, just lookup strings validated at publish time (see platform-services/workflow's systemActionRegistry.ts). */
const HANDLER_KEY_EMPLOYMENT_CHANGE = "hrms.workflow.employment_change.complete";
const HANDLER_KEY_OFFBOARDING = "hrms.workflow.offboarding.complete";

/** The generic HR-approval permission this foundation routes ROLE-mode approval on — reuses the SAME permission that already gates directly completing the case, so anyone Workflow resolves as an eligible approver is, by construction, also authorised for the completion call the handler makes on their behalf. See docs "Approval routing". */
const APPROVAL_PERMISSION_BY_TYPE = {
  employment_change: { base: "hrms.lifecycle.manage_employment_change", privileged: "hrms.lifecycle.manage_employment_change.privileged" },
  offboarding: { base: "hrms.lifecycle.manage_offboarding", privileged: "hrms.lifecycle.manage_offboarding.privileged" },
} as const;

/**
 * The actor attributed for the AUTHORITATIVE HRMS/Organisation completion
 * write is the case's own `hrOwnerUserId` — never the deciding approver
 * (`ctx.recordedBy`, already correctly attributed on the Workflow
 * decision itself). This matters because platform-services/hrms's own
 * completeChange()/completeOffboarding() (unchanged since PR #7) require
 * their caller to ALSO hold Organisation's employee_master.manage_assignment
 * permission, not just HRMS's manage_employment_change/manage_offboarding —
 * a pre-existing, deliberate defence-in-depth requirement for anyone who
 * directly triggers a business-domain mutation. Requiring every ROLE-
 * eligible Workflow approver to ALSO personally hold that raw Organisation
 * permission would conflate "authorised to approve" with "authorised to
 * directly write Employee Master data", which this foundation's domain
 * boundary treats as distinct. The case's HR owner — already a real,
 * established user (required at case-creation time), operationally the
 * person responsible for seeing the case through to completion — is the
 * correct actor for this specific write; they must hold both permissions,
 * exactly like anyone completing a case directly. See docs/architecture/
 * hrms-workflow-integration.md "Employment Change" / "Offboarding".
 */
async function resolveHrOwnerActor(ctx: SystemActionContext, hrOwnerUserId: string): Promise<ActorContext> {
  const users = createPgUserRepository(ctx.tx);
  const user = await users.findById(hrOwnerUserId);
  if (!user) throw new Error(`HR owner ${hrOwnerUserId} no longer exists.`);
  return { userId: user.id, email: user.email };
}

/**
 * Registers the two SYSTEM_ACTION handlers into `workflow`'s OWN registry
 * (never platform-services/workflow's own composition root's registry —
 * that stays empty, unaware any business domain exists) and installs
 * (idempotently, once published, never re-published) the two Workflow
 * definitions this integration needs. Returns the WorkflowSubmissionPort
 * approvalService depends on.
 */
export function createHrmsWorkflowIntegration(deps: { workflow: WorkflowContainer; rbac: RbacService }): WorkflowSubmissionPort {
  deps.workflow.systemActions.register(HANDLER_KEY_EMPLOYMENT_CHANGE, async (ctx: SystemActionContext) => {
    const caseId = ctx.instance.subjectId;
    const cases = createPgLifecycleCaseRepository(ctx.tx);
    const hrCase = await cases.findById(caseId);
    if (!hrCase) throw new Error(`HRMS lifecycle case ${caseId} not found for employment-change completion.`);
    if (!hrCase.pendingCompletionInput) throw new Error(`HRMS lifecycle case ${caseId} has no pendingCompletionInput recorded at submission time.`);
    const actor = await resolveHrOwnerActor(ctx, hrCase.hrOwnerUserId);
    const employmentChange = createEmploymentChangeServiceForTransaction(ctx.tx, deps.rbac);
    const assignmentInput: CreateAssignmentInput = { ...(hrCase.pendingCompletionInput as unknown as CreateAssignmentInput), legalEntityId: hrCase.legalEntityId };
    await employmentChange.completeChange(actor, caseId, assignmentInput);
  });

  deps.workflow.systemActions.register(HANDLER_KEY_OFFBOARDING, async (ctx: SystemActionContext) => {
    const caseId = ctx.instance.subjectId;
    const cases = createPgLifecycleCaseRepository(ctx.tx);
    const hrCase = await cases.findById(caseId);
    if (!hrCase) throw new Error(`HRMS lifecycle case ${caseId} not found for offboarding completion.`);
    if (!hrCase.pendingCompletionInput) throw new Error(`HRMS lifecycle case ${caseId} has no pendingCompletionInput recorded at submission time.`);
    const actor = await resolveHrOwnerActor(ctx, hrCase.hrOwnerUserId);
    const input = hrCase.pendingCompletionInput as unknown as { endDate: string; status: "TERMINATED" | "RESIGNED"; changeReason?: string };
    const offboarding = createOffboardingServiceForTransaction(ctx.tx, deps.rbac);
    await offboarding.completeOffboarding(actor, caseId, input);
  });

  return {
    async submit(actor, input) {
      const instance = await deps.workflow.instances.startWorkflow(actor, {
        definitionKey: input.definitionKey,
        subjectType: "hrms.lifecycle",
        subjectId: input.caseId,
        legalEntityId: input.legalEntityId,
        subjectEmployeeId: input.employeeId,
      });
      return { workflowInstanceId: instance.id, status: instance.status };
    },
    async getStatus(actor, workflowInstanceId): Promise<WorkflowStatusResult | null> {
      try {
        const instance = await deps.workflow.instances.getInstance(actor, workflowInstanceId);
        return { status: instance.status, outcome: instance.outcome };
      } catch (error) {
        if (error instanceof WorkflowNotFoundError) return null;
        throw error;
      }
    },
  };
}

/**
 * Idempotent bootstrap for the two ROLE-routed, two-step (APPROVAL then
 * SYSTEM_ACTION) Workflow definitions this integration needs. Never
 * seeds real employees/users/approver UUIDs — routing is entirely
 * ROLE-based against the SAME permission that already gates direct
 * completion (see APPROVAL_PERMISSION_BY_TYPE above), so production
 * configuration is just granting that permission to the right people via
 * Identity's existing RBAC, never a code/definition change.
 *
 * NOT wired into createHrmsContainer's own construction — composition-
 * root construction has no authenticated actor to attribute the
 * definition's createdBy/audit trail to, and installing mutable
 * application data automatically on every process start is exactly the
 * kind of implicit, hard-to-audit side effect this foundation avoids
 * elsewhere (see docs "Workflow definition installation strategy" for the
 * alternatives assessed). Call this explicitly instead, supplying a real,
 * already-permissioned actor: platform-services/hrms/scripts/
 * installWorkflowDefinitions.ts for a real environment, or a test's own
 * admin fixture for tests. Safe to call repeatedly — a definition whose
 * key already exists and already has a PUBLISHED version is left
 * untouched.
 */
export async function installHrmsWorkflowDefinitions(workflow: WorkflowContainer, actor: ActorContext): Promise<void> {
  await installOne(workflow, actor, DEFINITION_KEY_BY_TYPE.employment_change, "HRMS Employment Change Approval", APPROVAL_PERMISSION_BY_TYPE.employment_change, HANDLER_KEY_EMPLOYMENT_CHANGE);
  await installOne(workflow, actor, DEFINITION_KEY_BY_TYPE.offboarding, "HRMS Offboarding Approval", APPROVAL_PERMISSION_BY_TYPE.offboarding, HANDLER_KEY_OFFBOARDING);
}

async function installOne(
  workflow: WorkflowContainer,
  actor: ActorContext,
  definitionKey: string,
  name: string,
  permission: { base: string; privileged: string },
  handlerKey: string,
): Promise<void> {
  const existing = (await workflow.definitions.listDefinitions(actor)).find((d) => d.key === definitionKey);
  if (existing) {
    const versions = await workflow.definitions.listVersions(actor, existing.id);
    if (versions.some((v) => v.status === "PUBLISHED")) return; // already installed — nothing further to do
    // A definition exists but was never published — most likely this
    // exact bootstrap was interrupted mid-way on a prior run. This
    // foundation does not attempt automatic partial-state recovery (no
    // generic retry framework); createDefinition below will throw a
    // clear, actionable error ("already exists") for an operator to
    // resolve by hand, rather than silently guessing which half-built
    // version to resume.
  }

  const { version } = await workflow.definitions.createDefinition(actor, { key: definitionKey, name });

  await workflow.definitions.addStep(actor, version.id, {
    sequenceNumber: 1,
    stepType: "APPROVAL",
    name: "Approve",
    assignmentMode: "ROLE",
    assignedPermissionKey: permission.base,
    assignedPermissionKeyPrivileged: permission.privileged,
    allowSelfApproval: false,
    // RETURN is not offered: this is the first step, and — per this PR's
    // review of Workflow's own routing semantics — RETURN from the first
    // step is not possible. A clean terminate-and-resubmit model is used
    // instead: REJECT sends the case back to editable IN_PROGRESS via
    // approvalService's own reconciliation. See docs "Rejection/return
    // semantics".
    permittedDecisions: ["APPROVE", "REJECT"],
  });
  await workflow.definitions.addStep(actor, version.id, {
    sequenceNumber: 2,
    stepType: "SYSTEM_ACTION",
    name: "Complete",
    systemActionHandlerKey: handlerKey,
  });
  await workflow.definitions.publish(actor, version.id);
}
