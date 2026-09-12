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
