/**
 * Code-controlled registry of SYSTEM_ACTION handlers (PR brief item 21 —
 * a critical security boundary). A workflow definition's SYSTEM_ACTION
 * step stores only a `handlerKey` string; publishing validates that key
 * against this registry (see definitionService's publish validation).
 * There is no mechanism anywhere in this package to execute stored code,
 * SQL, shell commands, or an arbitrary HTTP URL — a handler is a plain
 * TypeScript function, registered here at composition time, and the
 * registry itself never grows at runtime from request input.
 *
 * A factory (not a module-level singleton) so each composition root — and
 * each test file — gets its own independent registry, never leaking
 * registrations across unrelated test files sharing one Node process.
 *
 * No real handler is registered by this PR's own composition root
 * (createWorkflowContainer): no business domain is integrated yet (PR
 * brief item 4) — see platform-services/hrms/src/integrations for the
 * first real registration (PR #9), which registers its handlers into a
 * HrmsContainer-owned registry instance, never into this package's own.
 *
 * `ctx.tx` (PR #9 addition) is the SAME transaction-scoped
 * DatabaseProvider connection every other write in this activation
 * shares — a handler that needs to write to another package's own
 * tables (through that package's own transaction-scoped composition
 * helper, never a raw query) binds to THIS connection so its writes
 * commit or roll back together with the Workflow decision that
 * triggered it. `ctx.recordedBy` is the userId that triggered this
 * activation (the deciding actor for a decision-triggered SYSTEM_ACTION,
 * or the requester for one activated as step 1) — always a real,
 * existing `users.id`, suitable as the actor for an authoritative
 * write in another package. See docs/architecture/
 * hrms-workflow-integration.md "Transaction boundary".
 */
import type { DatabaseProvider } from "../../../../packages/shared/src/DatabaseProvider.ts";
import type { WorkflowInstance, WorkflowStep } from "./workflow.ts";

export interface SystemActionContext {
  instance: WorkflowInstance;
  step: WorkflowStep;
  tx: DatabaseProvider;
  recordedBy: string | null;
}

/**
 * A handler must not throw for expected business conditions it can
 * distinguish. Any thrown error propagates all the way out of the
 * enclosing `WorkflowTransaction.run()` call — the WHOLE transaction
 * (this activation, the decision that triggered it, every write the
 * handler itself made against `ctx.tx`) rolls back together; nothing is
 * left partially applied (PR #9 review: see docs/architecture/
 * hrms-workflow-integration.md "Transaction boundary" for why the
 * original PR #8 "catch, mark FAILED, commit anyway" behaviour was
 * unsafe for a handler with real cross-package writes, and
 * docs/architecture/workflow-approval-foundation.md §22a for the
 * corrected failure semantics). A handler that wants to record a
 * durable, non-retryable failure instead of a full rollback must catch
 * its OWN error, write that failure itself (in its own separate
 * transaction, never on `ctx.tx`), and return normally.
 */
export type SystemActionHandler = (ctx: SystemActionContext) => Promise<void>;

export function createSystemActionRegistry() {
  const handlers = new Map<string, SystemActionHandler>();
  return {
    register(key: string, handler: SystemActionHandler): void {
      if (handlers.has(key)) throw new Error(`System action handler already registered: ${key}`);
      handlers.set(key, handler);
    },
    isRegistered(key: string): boolean {
      return handlers.has(key);
    },
    registeredKeys(): string[] {
      return [...handlers.keys()];
    },
    async execute(key: string, ctx: SystemActionContext): Promise<void> {
      const handler = handlers.get(key);
      if (!handler) throw new Error(`No system action handler registered for key: ${key}`);
      await handler(ctx);
    },
  };
}

export type SystemActionRegistry = ReturnType<typeof createSystemActionRegistry>;
