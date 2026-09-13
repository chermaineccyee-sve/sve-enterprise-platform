/**
 * One-off operational command: installs (idempotently) the two Workflow
 * definitions this integration needs (hrms.employment_change,
 * hrms.offboarding) — see src/integrations/workflowIntegration.ts's
 * installHrmsWorkflowDefinitions for why this is a deliberate,
 * explicitly-run administrative command rather than something the
 * composition root or a migration does automatically. Mirrors
 * platform-services/identity/scripts/migrate.ts's own CLI convention.
 *
 * Usage: DATABASE_URL=... HRMS_WORKFLOW_BOOTSTRAP_ADMIN_EMAIL=admin@example.test
 *        node platform-services/hrms/scripts/installWorkflowDefinitions.ts
 *
 * The named user must already exist in Identity and already hold
 * workflow.definition.create/update/publish (see docs/architecture/
 * hrms-workflow-integration.md "Workflow definition installation
 * strategy") — this script grants nothing; it only uses an existing,
 * already-authorised identity, exactly like any other authenticated
 * caller of platform-services/workflow's own definition API.
 */
import { createPgDatabaseProvider } from "../../identity/src/repositories/postgres/pgDatabaseProvider.ts";
import { createHrmsContainer } from "../src/composition/container.ts";
import { installHrmsWorkflowDefinitions } from "../src/integrations/workflowIntegration.ts";

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }
  const adminEmail = process.env.HRMS_WORKFLOW_BOOTSTRAP_ADMIN_EMAIL;
  if (!adminEmail) {
    console.error("HRMS_WORKFLOW_BOOTSTRAP_ADMIN_EMAIL is required — the email of an existing user already holding workflow.definition.create/update/publish.");
    process.exit(1);
  }

  const db = createPgDatabaseProvider(connectionString);
  try {
    const container = await createHrmsContainer(db);
    const admin = await container.users.findByEmail(adminEmail);
    if (!admin) {
      console.error(`No user found with email ${adminEmail}.`);
      process.exit(1);
    }
    await installHrmsWorkflowDefinitions(container.workflow, { userId: admin.id, email: admin.email });
    console.log("hrms.employment_change and hrms.offboarding are installed (or were already present).");
  } finally {
    await db.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
