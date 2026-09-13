export class NotFoundError extends Error {
  constructor(resource: string) {
    super(`${resource} not found.`);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** A requested lifecycle status/decision transition is not legitimate from the case's current state — see domain/stateMachine.ts. */
export class InvalidTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTransitionError";
  }
}

/**
 * PR #11: thrown by src/api/middleware/actor.ts when a state-changing
 * request authenticated via the transitional SVEGIP session-cookie
 * bridge does not carry a trusted Origin/Referer — mirrors
 * platform-services/organisation's own CsrfOriginRejectedError exactly.
 */
export class CsrfOriginRejectedError extends Error {
  constructor() {
    super("This request's origin could not be verified as trusted.");
    this.name = "CsrfOriginRejectedError";
  }
}
