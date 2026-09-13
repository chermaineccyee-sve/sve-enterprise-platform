/**
 * This package's own domain errors — resource/input concerns with no
 * Identity meaning, so not borrowed from platform-services/identity (see
 * employeeService.ts's header comment on dependency direction).
 * Identity/authentication-outcome errors (SessionInvalidError,
 * AccountDisabledError, ForbiddenError) remain imported from
 * platform-services/identity/src/domain/errors.ts, since those ARE
 * Identity contracts this package depends on.
 */
export class NotFoundError extends Error {
  constructor(resourceType: string) {
    super(`${resourceType} not found.`);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Thrown by src/api/middleware/actor.ts when a state-changing (POST/PUT/
 * PATCH/DELETE) request authenticated via the transitional SVEGIP
 * session-cookie bridge does not carry a trusted Origin/Referer — mirrors
 * platform-services/data-vault's own CsrfOriginRejectedError exactly (see
 * that package's domain/errors.ts and docs/architecture/
 * data-vault-foundation.md "CSRF/origin protection for the SVEGIP cookie
 * bridge"). Never thrown for native bearer-session requests.
 */
export class CsrfOriginRejectedError extends Error {
  constructor() {
    super("This request's origin could not be verified as trusted.");
    this.name = "CsrfOriginRejectedError";
  }
}
