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
 * brief item 4). `identity.request_deactivation` is documented in the
 * architecture doc as the illustrative FUTURE handler a later PR would
 * register — it is not implemented here, since Identity itself exposes
 * no deactivation mutation to call (see platform-services/hrms's own
 * `identity_deactivation_requested` EVENT for the same reasoning).
 */
import type { WorkflowInstance, WorkflowStep } from "./workflow.ts";

export interface SystemActionContext {
  instance: WorkflowInstance;
  step: WorkflowStep;
}

/** A handler must not throw for expected business conditions it can distinguish — but any thrown error is caught by the caller and recorded as a failed execution (see instanceService). */
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
