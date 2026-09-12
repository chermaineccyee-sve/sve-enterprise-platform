/**
 * Composition root: wires concrete repositories (Postgres or in-memory) to
 * the services that depend only on the repository interfaces. This is the
 * one place that knows which concrete implementation is in use — see
 * docs/architecture/platform-architecture.md "platform-services/core" and
 * deployment-portability.md. The API layer (src/api/*) depends only on this
 * container's shape, never on Postgres or `pg` directly.
 */
import type { DatabaseProvider } from "../../../packages/shared/src/DatabaseProvider.ts";
import { createPgUserRepository } from "./repositories/postgres/pgUserRepository.ts";
import { createPgOrganisationRepository } from "./repositories/postgres/pgOrganisationRepository.ts";
import { createPgRbacRepository } from "./repositories/postgres/pgRbacRepository.ts";
import { createPgSessionRepository } from "./repositories/postgres/pgSessionRepository.ts";
import { createPgMfaRepository } from "./repositories/postgres/pgMfaRepository.ts";
import { createPgAttemptRepository } from "./repositories/postgres/pgAttemptRepository.ts";
import { createPgAuditRepository } from "./repositories/postgres/pgAuditRepository.ts";
import { createAuthService, type AuthService } from "./services/authService.ts";
import { createSessionService, type SessionService } from "./services/sessionService.ts";
import { createRbacService, type RbacService } from "./services/rbacService.ts";
import { createMfaService, type MfaService } from "./services/mfaService.ts";
import { createRateLimiter, type RateLimiter } from "./services/rateLimiter.ts";
import { createAuditService, type AuditService } from "./services/auditService.ts";
import type { UserRepository, OrganisationRepository } from "./repositories/types.ts";

export interface Container {
  users: UserRepository;
  organisation: OrganisationRepository;
  auth: AuthService;
  sessions: SessionService;
  rbac: RbacService;
  mfa: MfaService;
  rateLimiter: RateLimiter;
  audit: AuditService;
}

export function createContainer(db: DatabaseProvider): Container {
  const users = createPgUserRepository(db);
  const organisation = createPgOrganisationRepository(db);
  const rbacRepo = createPgRbacRepository(db);
  const sessionRepo = createPgSessionRepository(db);
  const mfaRepo = createPgMfaRepository(db);
  const attemptRepo = createPgAttemptRepository(db);
  const auditRepo = createPgAuditRepository(db);

  const mfa = createMfaService({ mfa: mfaRepo });
  const rateLimiter = createRateLimiter({ attempts: attemptRepo });
  const sessions = createSessionService({ sessions: sessionRepo });
  const rbac = createRbacService({ rbac: rbacRepo, organisation });
  const audit = createAuditService({ audit: auditRepo });
  const auth = createAuthService({ users, attempts: attemptRepo, mfa, rateLimiter });

  return { users, organisation, auth, sessions, rbac, mfa, rateLimiter, audit };
}
