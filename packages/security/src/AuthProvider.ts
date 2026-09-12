/**
 * Authentication provider contract. Contract only — no implementation.
 *
 * Lets the platform swap authentication backends (local password + future
 * MFA, AWS Cognito, an enterprise SSO/identity provider) without business
 * logic depending on any one of them directly. Never call a vendor SDK
 * (e.g. Netlify, Cognito) from a domain service — only from a concrete
 * AuthProvider implementation wired in platform-services/core.
 */
import type { SessionContext } from "./rbac";

export interface Credentials {
  email: string;
  password: string;
}

export interface AuthChallenge {
  /** Present when primary auth succeeded but MFA is required to complete login. */
  mfaRequired: boolean;
  challengeId?: string;
}

export interface AuthProvider {
  /** Verifies primary credentials. Does not by itself establish a session. */
  verifyCredentials(credentials: Credentials): Promise<AuthChallenge>;

  /** Completes login after any required MFA challenge, issuing a session. */
  completeLogin(challengeId: string | undefined, mfaCode?: string): Promise<SessionContext>;

  /** Validates an existing session token/cookie and returns its current context. */
  resolveSession(token: string): Promise<SessionContext | null>;

  /** Revokes one session (e.g. sign-out, or an admin-initiated revoke). */
  revokeSession(sessionId: string): Promise<void>;

  /** Revokes every session for a user — e.g. on password reset or account deactivation. */
  revokeAllSessions(userId: string): Promise<void>;
}
