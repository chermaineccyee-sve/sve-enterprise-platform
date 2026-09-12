/**
 * Typed domain errors. Messages here are for internal/log use — API
 * responses map these to the generic, enumeration-resistant messages
 * required by docs/architecture/identity-foundation.md "Login protection",
 * never these internal messages verbatim.
 */
export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid credentials.");
    this.name = "InvalidCredentialsError";
  }
}

export class AccountDisabledError extends Error {
  constructor() {
    super("Account is disabled.");
    this.name = "AccountDisabledError";
  }
}

export class ThrottledError extends Error {
  retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super("Too many attempts; throttled.");
    this.name = "ThrottledError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class SessionInvalidError extends Error {
  constructor(reason: "expired" | "revoked" | "not_found") {
    super(`Session invalid: ${reason}`);
    this.name = "SessionInvalidError";
  }
}

export class MfaRequiredError extends Error {
  challengeId: string;
  constructor(challengeId: string) {
    super("MFA verification required.");
    this.name = "MfaRequiredError";
    this.challengeId = challengeId;
  }
}

export class MfaVerificationError extends Error {
  constructor() {
    super("MFA verification failed.");
    this.name = "MfaVerificationError";
  }
}

export class MfaAlreadyActiveError extends Error {
  constructor() {
    super("An active MFA method already exists.");
    this.name = "MfaAlreadyActiveError";
  }
}

export class RecoveryCodeInvalidError extends Error {
  constructor() {
    super("Recovery code is invalid or already used.");
    this.name = "RecoveryCodeInvalidError";
  }
}

export class ForbiddenError extends Error {
  constructor(permissionKey: string) {
    super(`Not authorised: ${permissionKey}`);
    this.name = "ForbiddenError";
  }
}

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
 * Thrown by the SVEGIP session bridge (src/services/svegipSessionBridge.ts,
 * src/api/middleware/dataVaultActor.ts) when a request carries a validly
 * signed SVEGIP session cookie but no corresponding row exists yet in this
 * service's own `users` table. This is a deliberate default-deny, not an
 * error: SVEGIP authenticating someone is never, by itself, sufficient to
 * authorize them here — see docs/architecture/data-vault-foundation.md
 * "SVEGIP/Identity transitional authentication boundary".
 */
export class IdentityNotProvisionedError extends Error {
  constructor() {
    super("This account is not yet provisioned in the SVE Identity service.");
    this.name = "IdentityNotProvisionedError";
  }
}
