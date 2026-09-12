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
