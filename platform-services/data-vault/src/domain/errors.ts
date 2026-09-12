/**
 * Data Vault's own domain errors — resource/input/request-layer concerns
 * with no Identity meaning, so they are not borrowed from platform-
 * services/identity (see dataVaultService.ts's header comment on
 * dependency direction). Identity/authentication-outcome errors
 * (SessionInvalidError, AccountDisabledError, IdentityNotProvisionedError,
 * ForbiddenError) remain imported from platform-services/identity/src/
 * domain/errors.ts, since those ARE Identity contracts this package
 * depends on.
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
 * Thrown by src/api/middleware/dataVaultActor.ts when a state-changing
 * (POST/PUT/PATCH/DELETE) request authenticated via the transitional
 * SVEGIP session-cookie bridge does not carry a trusted Origin/Referer —
 * see docs/architecture/data-vault-foundation.md "CSRF/origin protection
 * for the SVEGIP cookie bridge". Never thrown for native bearer-session
 * requests, where this threat model does not apply.
 */
export class CsrfOriginRejectedError extends Error {
  constructor() {
    super("This request's origin could not be verified as trusted.");
    this.name = "CsrfOriginRejectedError";
  }
}
