/**
 * The one, small, universal lifecycle-status transition table — not a
 * generic state-machine framework (PR brief item 25 explicitly warns
 * against one). Shared by every lifecycle type, since the same five
 * statuses (DRAFT/IN_PROGRESS/PENDING_DECISION/COMPLETED/CANCELLED)
 * generalise cleanly across onboarding/probation/employment_change/
 * offboarding — see docs/architecture/hrms-employee-lifecycle.md "State
 * transitions".
 */
import type { LifecycleStatus } from "./lifecycle.ts";
import { InvalidTransitionError } from "./errors.ts";

const LEGAL_TRANSITIONS: Record<LifecycleStatus, LifecycleStatus[]> = {
  DRAFT: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["PENDING_DECISION", "COMPLETED", "CANCELLED"],
  PENDING_DECISION: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

/**
 * Throws InvalidTransitionError if `to` is not reachable from `from`.
 * COMPLETED/CANCELLED are always terminal — no explicitly-authorised
 * correction/reopen mechanism exists in this foundation (see the
 * architecture doc's remaining risks), so ANY further transition attempt
 * from a terminal status is rejected, including a same-status one (never
 * silently re-"complete" an already-completed case). A same-status
 * transition FROM a non-terminal status is allowed as a no-op — e.g.
 * probation's EXTENDED decision keeps the case IN_PROGRESS while its
 * current_stage/review data changes; this is stage progress, not a status
 * transition, and does not need its own entry in the table below.
 */
export function assertValidTransition(from: LifecycleStatus, to: LifecycleStatus): void {
  if (isTerminal(from)) {
    throw new InvalidTransitionError(`Cannot transition a lifecycle case out of its terminal ${from} status.`);
  }
  if (from === to) return;
  if (!LEGAL_TRANSITIONS[from].includes(to)) {
    throw new InvalidTransitionError(`Cannot transition a lifecycle case from ${from} to ${to}.`);
  }
}

export function isTerminal(status: LifecycleStatus): boolean {
  return status === "COMPLETED" || status === "CANCELLED";
}
