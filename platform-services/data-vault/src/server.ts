/**
 * Local development entrypoint only: `npm run dev`. Not deployed anywhere
 * by this PR, and does not repoint or replace apps/svegip's Netlify
 * deployment. Requires DATABASE_URL (the same database Identity migrates)
 * and PORT (defaults to 4002, distinct from Identity's own 4001) in the
 * environment. SVEGIP_SESSION_SECRET and SVE_DATA_VAULT_TRUSTED_ORIGINS
 * are optional — see .env.example.
 */
import { createPgDatabaseProvider } from "../../identity/src/repositories/postgres/pgDatabaseProvider.ts";
import { createDataVaultContainer } from "./composition/container.ts";
import { createHttpServer } from "./api/http.ts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required to start the Data Vault service.");
  process.exit(1);
}

const db = createPgDatabaseProvider(connectionString);

const container = await createDataVaultContainer(db);
const server = createHttpServer(container);
const port = Number(process.env.PORT ?? 4002);

server.listen(port, () => {
  console.log(`SVE Data Vault listening on :${port} (local development only)`);
});

process.on("SIGTERM", async () => {
  server.close();
  await db.close();
  process.exit(0);
});
