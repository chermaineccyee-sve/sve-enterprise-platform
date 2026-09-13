/**
 * Local development entrypoint only: `npm run dev`. Not deployed anywhere
 * by this PR. Requires DATABASE_URL (the same database Identity,
 * Data Vault, Organisation, and HRMS migrate) and PORT (defaults to 4005)
 * in the environment.
 */
import { createPgDatabaseProvider } from "../../identity/src/repositories/postgres/pgDatabaseProvider.ts";
import { createWorkflowContainer } from "./composition/container.ts";
import { createHttpServer } from "./api/http.ts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required to start the Workflow service.");
  process.exit(1);
}

const db = createPgDatabaseProvider(connectionString);

const container = await createWorkflowContainer(db);
const server = createHttpServer(container);
const port = Number(process.env.PORT ?? 4005);

server.listen(port, () => {
  console.log(`SVE Workflow & Approval Foundation listening on :${port} (local development only)`);
});

process.on("SIGTERM", async () => {
  server.close();
  await db.close();
  process.exit(0);
});
