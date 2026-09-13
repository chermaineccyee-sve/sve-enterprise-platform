/**
 * The minimal port HRMS's own service layer depends on to start and
 * observe an approval workflow — never Workflow's own concrete types
 * (PR #9 brief item 4: "use services/integration ports"). The concrete
 * implementation (platform-services/hrms/src/integrations/
 * workflowIntegration.ts) is the ONE place in this package that actually
 * imports platform-services/workflow — approvalService.ts itself stays
 * blind to it, exactly like every other HRMS service depends on
 * repository INTERFACES, never a concrete Postgres/in-memory
 * implementation. See docs/architecture/hrms-workflow-integration.md
 * "Integration/composition boundary".
 */
import type { ActorContext } from "./access.ts";

export interface WorkflowSubmissionResult {
  workflowInstanceId: string;
  status: string;
}

export interface WorkflowStatusResult {
  status: string;
  outcome: string | null;
}

export interface WorkflowSubmissionPort {
  /**
   * Starts the approval workflow for a given HRMS lifecycle case. Must be
   * safe to call more than once for the SAME caseId (the underlying
   * Workflow instance's own natural "at most one ACTIVE instance per
   * definition+subject" constraint is the backstop — see
   * docs "Idempotency"); approvalService itself is the primary
   * idempotency guard (a row-locked case-status check), so this is a
   * defence-in-depth requirement, not the only one.
   */
  submit(actor: ActorContext, input: { definitionKey: string; caseId: string; legalEntityId: string; employeeId: string }): Promise<WorkflowSubmissionResult>;
  /**
   * Read-only current status of a previously-started workflow instance,
   * from `actor`'s own Workflow-side read access. Returns null rather
   * than throwing when `actor` cannot see it (e.g. lacks Workflow's own
   * INSTANCE_READ permission and is not the instance's requester/an
   * assigned task holder) — approvalService degrades gracefully rather
   * than leaking a 403/404 distinction across the port boundary.
   */
  getStatus(actor: ActorContext, workflowInstanceId: string): Promise<WorkflowStatusResult | null>;
}
