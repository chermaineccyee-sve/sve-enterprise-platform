/**
 * Local development entrypoint only: `npm run dev`. Not deployed anywhere
 * by this PR, and does not repoint or replace apps/svegip's Netlify
 * deployment. Requires DATABASE_URL, SVE_IDENTITY_MFA_ENCRYPTION_KEY, and
 * PORT (defaults to 4001, distinct from apps/svegip's own dev ports) in the
 * environment.
 */
import { createPgDatabaseProvider } from "./repositories/postgres/pgDatabaseProvider.ts";
import { createContainer } from "./container.ts";
import { createHttpServer } from "./api/http.ts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required to start the Identity service.");
  process.exit(1);
}

const db = createPgDatabaseProvider(connectionString);

const container = await createContainer(db);
const server = createHttpServer(container);
const port = Number(process.env.PORT ?? 4001);

server.listen(port, () => {
  console.log(`SVE Identity & Access Foundation listening on :${port} (local development only)`);
});

process.on("SIGTERM", async () => {
  server.close();
  await db.close();
  process.exit(0);
});
