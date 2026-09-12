/**
 * Composition root: wires concrete repositories (Postgres or in-memory) to
 * the services that depend only on the repository interfaces. This is the
 * one place that knows which concrete implementation is in use — see
 * docs/architecture/platform-architecture.md "platform-services/core" and
 * deployment-portability.md. The API layer (src/api/*) depends only on this
 * container's shape, never on Postgres or `pg` directly.
 */
import type { DatabaseProvider } from "../../../packages/shared/src/DatabaseProvider.ts";
import type { SecretsProvider } from "../../../packages/security/src/SecretsProvider.ts";
import { createPgUserRepository } from "./repositories/postgres/pgUserRepository.ts";
import { createPgOrganisationRepository } from "./repositories/postgres/pgOrganisationRepository.ts";
import { createPgRbacRepository } from "./repositories/postgres/pgRbacRepository.ts";
import { createPgSessionRepository } from "./repositories/postgres/pgSessionRepository.ts";
import { createPgMfaRepository } from "./repositories/postgres/pgMfaRepository.ts";
import { createPgAttemptRepository } from "./repositories/postgres/pgAttemptRepository.ts";
import { createPgAuditRepository } from "./repositories/postgres/pgAuditRepository.ts";
import { createPgDataVaultRepository } from "./repositories/postgres/pgDataVaultRepository.ts";
import { createAuthService, type AuthService } from "./services/authService.ts";
import { createSessionService, type SessionService } from "./services/sessionService.ts";
import { createRbacService, type RbacService } from "./services/rbacService.ts";
import { createMfaService, type MfaService } from "./services/mfaService.ts";
import { createRateLimiter, type RateLimiter } from "./services/rateLimiter.ts";
import { createAuditService, type AuditService } from "./services/auditService.ts";
import { createDataVaultService, type DataVaultService } from "./services/dataVaultService.ts";
import { createEnvSecretsProvider } from "./config/envSecretsProvider.ts";
import { loadMfaEncryptionKey } from "./crypto/mfaSecretCipher.ts";
import { SVEGIP_BRIDGE_SECRET_ENV_VAR } from "./services/svegipSessionBridge.ts";
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
  dataVault: DataVaultService;
  /**
   * The shared secret for verifying apps/svegip's own signed session
   * cookie (see src/services/svegipSessionBridge.ts). Optional: absent
   * when this deployment doesn't need the transitional SVEGIP bridge
   * (e.g. a pure native-Identity environment), in which case requests
   * bearing only a svegip_session cookie are simply not authenticated —
   * never a crash, never a silent fallback to trusting the cookie.
   */
  svegipBridgeSecret: string | null;
}

/**
 * Async because loading/validating the MFA encryption key is async (it goes
 * through the SecretsProvider abstraction, not a direct synchronous
 * process.env read) — see src/crypto/mfaSecretCipher.ts. Defaults to
 * createEnvSecretsProvider() (local/private-server); pass a different
 * SecretsProvider (e.g. an AWS Secrets Manager-backed one, or a fixed test
 * key) to override.
 */
export async function createContainer(db: DatabaseProvider, opts?: { secrets?: SecretsProvider }): Promise<Container> {
  const secrets = opts?.secrets ?? createEnvSecretsProvider();
  const mfaEncryptionKey = await loadMfaEncryptionKey(secrets);

  const users = createPgUserRepository(db);
  const organisation = createPgOrganisationRepository(db);
  const rbacRepo = createPgRbacRepository(db);
  const sessionRepo = createPgSessionRepository(db);
  const mfaRepo = createPgMfaRepository(db);
  const attemptRepo = createPgAttemptRepository(db);
  const auditRepo = createPgAuditRepository(db);
  const dataVaultRepo = createPgDataVaultRepository(db);

  const mfa = createMfaService({ mfa: mfaRepo, encryptionKey: mfaEncryptionKey });
  const rateLimiter = createRateLimiter({ attempts: attemptRepo });
  const sessions = createSessionService({ sessions: sessionRepo });
  const rbac = createRbacService({ rbac: rbacRepo, organisation });
  const audit = createAuditService({ audit: auditRepo });
  const auth = createAuthService({ users, attempts: attemptRepo, mfa, rateLimiter });
  const dataVault = createDataVaultService({ dataVault: dataVaultRepo, rbac, organisation, audit });
  const svegipBridgeSecret = (await secrets.getSecret(SVEGIP_BRIDGE_SECRET_ENV_VAR)) ?? null;

  return { users, organisation, auth, sessions, rbac, mfa, rateLimiter, audit, dataVault, svegipBridgeSecret };
}
