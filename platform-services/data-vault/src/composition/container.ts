/**
 * Data Vault's own composition root. This — not platform-services/
 * identity — is where Identity and Data Vault are wired together: the
 * dependency runs one way (Data Vault depends on Identity's contracts and
 * concrete services), so the composition glue belongs on the dependent
 * side. Identity's container.ts has no knowledge of, or import from, this
 * file or anything else in this package. See docs/architecture/
 * data-vault-foundation.md "Module ownership and dependency direction".
 *
 * Every concrete Identity piece below is imported directly from
 * platform-services/identity's own source tree (by relative path, not a
 * published package — this monorepo has no workspace/package-registry
 * boundary between sibling platform-services yet). Nothing here
 * reimplements session validation, RBAC evaluation, audit redaction, or
 * Postgres connection handling — all of that stays defined exactly once,
 * in Identity.
 */
import type { DatabaseProvider } from "../../../../packages/shared/src/DatabaseProvider.ts";
import type { SecretsProvider } from "../../../../packages/security/src/SecretsProvider.ts";
import { createPgUserRepository } from "../../../identity/src/repositories/postgres/pgUserRepository.ts";
import { createPgOrganisationRepository } from "../../../identity/src/repositories/postgres/pgOrganisationRepository.ts";
import { createPgRbacRepository } from "../../../identity/src/repositories/postgres/pgRbacRepository.ts";
import { createPgSessionRepository } from "../../../identity/src/repositories/postgres/pgSessionRepository.ts";
import { createPgAuditRepository } from "../../../identity/src/repositories/postgres/pgAuditRepository.ts";
import { createSessionService, type SessionService } from "../../../identity/src/services/sessionService.ts";
import { createRbacService, type RbacService } from "../../../identity/src/services/rbacService.ts";
import { createAuditService, type AuditService } from "../../../identity/src/services/auditService.ts";
import { createEnvSecretsProvider } from "../../../identity/src/config/envSecretsProvider.ts";
import { loadSvegipBridgeSecret } from "../../../identity/src/services/svegipSessionBridge.ts";
import type { UserRepository, OrganisationRepository } from "../../../identity/src/repositories/types.ts";
import { createPgDataVaultRepository } from "../repositories/postgres/pgDataVaultRepository.ts";
import { createDataVaultService, type DataVaultService } from "../services/dataVaultService.ts";
import { loadTrustedOrigins } from "../config/trustedOrigins.ts";

export interface DataVaultContainer {
  users: UserRepository;
  organisation: OrganisationRepository;
  sessions: SessionService;
  rbac: RbacService;
  audit: AuditService;
  dataVault: DataVaultService;
  /** Null when the transitional SVEGIP bridge is not configured for this deployment — see svegipSessionBridge.ts. */
  svegipBridgeSecret: string | null;
  /** Origins trusted for cookie-authenticated state-changing requests — see config/trustedOrigins.ts. */
  trustedOrigins: Set<string>;
}

export async function createDataVaultContainer(db: DatabaseProvider, opts?: { secrets?: SecretsProvider }): Promise<DataVaultContainer> {
  const secrets = opts?.secrets ?? createEnvSecretsProvider();

  const users = createPgUserRepository(db);
  const organisation = createPgOrganisationRepository(db);
  const rbacRepo = createPgRbacRepository(db);
  const sessionRepo = createPgSessionRepository(db);
  const auditRepo = createPgAuditRepository(db);
  const dataVaultRepo = createPgDataVaultRepository(db);

  const sessions = createSessionService({ sessions: sessionRepo });
  const rbac = createRbacService({ rbac: rbacRepo, organisation });
  const audit = createAuditService({ audit: auditRepo });
  const dataVault = createDataVaultService({ dataVault: dataVaultRepo, rbac, organisation, audit });

  const svegipBridgeSecret = await loadSvegipBridgeSecret(secrets);
  const trustedOrigins = loadTrustedOrigins();

  return { users, organisation, sessions, rbac, audit, dataVault, svegipBridgeSecret, trustedOrigins };
}
