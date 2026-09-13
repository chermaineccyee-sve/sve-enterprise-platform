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

/** A workflow-specific "cannot proceed" error — an already-decided task, an already-terminal instance, an invalid publish, etc. Distinct from ValidationError (bad input shape) and NotFoundError (no such row). */
export class InvalidStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStateError";
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
