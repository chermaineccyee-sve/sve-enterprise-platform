/**
 * DEPLOY PREFLIGHT — run by scripts/cms/deploy.mjs before `next build`, with
 * DATABASE_URL pointing at the direct (non-pooled) database connection.
 * Any failure exits non-zero, which fails the Netlify build: the previous
 * deploy stays live and nothing is half-applied.
 *
 *   1. Environment rules (src/cms/env.ts).
 *   2. Database reachable, over TLS outside development.
 *   3. Data-environment marker: the database records which CMS_DATA_ENV owns
 *      it on first deploy; a deployment with a different CMS_DATA_ENV (e.g. a
 *      preview pointed at the production database) is refused.
 *   4. Pending migrations. Each migration runs in its own transaction.
 *      CMS_MIGRATIONS=apply applies them; check (the production default)
 *      fails the build instead, so production schema changes are deliberate.
 *   5. Destructive-change guard: on a database that already has migrations,
 *      a pending migration that drops, renames, truncates or retypes anything
 *      needs CMS_ALLOW_DESTRUCTIVE_MIGRATION=<that migration's name>.
 *   6. Bootstrap status (no secrets printed).
 */
import config from "@payload-config";
import { sql } from "@payloadcms/db-postgres";
import { getPayload } from "payload";
import { checkCmsEnv } from "../env";
import { logEvent } from "../log";
import { migrations } from "../migrations";

const fail = (msg: string, extra: Record<string, unknown> = {}): never => {
  logEvent("error", "cms.preflight.failed", { reason: msg, ...extra });
  console.error(`\n✗ Admin Portal preflight failed: ${msg}\n`);
  process.exit(1);
};
const ok = (msg: string) => console.info(`✓ ${msg}`);

const { problems, warnings, dataEnv } = checkCmsEnv();
for (const w of warnings) console.warn(`! ${w}`);
if (problems.length) fail(`environment\n  - ${problems.join("\n  - ")}`);
ok(`environment (CMS_DATA_ENV=${dataEnv}${process.env.CONTEXT ? `, Netlify context ${process.env.CONTEXT}` : ""})`);

const payload = await getPayload({ config });
type Db = { drizzle: { execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }> } };
const db = payload.db as unknown as Db;
const q = async (query: unknown) => (await db.drizzle.execute(query)).rows;

// 2. Connectivity and TLS.
let info: Record<string, unknown>;
try {
  [info] = await q(sql`select current_database() as db, current_setting('server_version') as version, coalesce((select ssl from pg_stat_ssl where pid = pg_backend_pid()), false) as ssl`);
} catch (err) {
  logEvent("error", "cms.db.unreachable", { phase: "preflight", error: err });
  fail("database unreachable (check DATABASE_URL_UNPOOLED / DATABASE_URL and the database's IP allow-list)");
}
if (dataEnv !== "development" && !info!.ssl) fail("database connection is not using TLS");
ok(`database reachable (${info!.db}, PostgreSQL ${info!.version}, TLS ${info!.ssl ? "on" : "off"})`);

// 3. Data-environment marker (outside Payload's schema; created idempotently here).
await q(sql`create table if not exists nusantara_meta (key text primary key, value text not null, updated_at timestamptz not null default now())`);
const [marker] = await q(sql`select value from nusantara_meta where key = 'data_environment'`);
if (!marker) {
  await q(sql`insert into nusantara_meta (key, value) values ('data_environment', ${dataEnv!}) on conflict (key) do nothing`);
  ok(`database claimed for CMS_DATA_ENV=${dataEnv}`);
} else if (marker.value !== dataEnv) {
  fail(`this database belongs to the "${marker.value}" data environment, but this deployment has CMS_DATA_ENV=${dataEnv}. Use the matching database.`);
} else ok(`database belongs to the ${dataEnv} data environment`);

// 4–5. Migrations.
const [{ exists }] = await q(sql`select to_regclass('public.payload_migrations') is not null as exists`);
const applied = new Set(exists ? (await q(sql`select name from payload_migrations where batch > 0`)).map((r) => String(r.name)) : []);
const pending = migrations.filter((m) => !applied.has(m.name));
const DESTRUCTIVE = /\b(DROP\s+(TABLE|COLUMN|TYPE|SCHEMA|INDEX|CONSTRAINT)|TRUNCATE|RENAME\s+(TO|COLUMN)|ALTER\s+COLUMN\s+"?\w+"?\s+(SET\s+DATA\s+)?TYPE|DELETE\s+FROM)\b/gi;
if (pending.length && applied.size > 0) {
  for (const m of pending) {
    const hits = [...new Set((m.up.toString().match(DESTRUCTIVE) ?? []).map((h) => h.replace(/\s+/g, " ").toUpperCase()))];
    if (hits.length && process.env.CMS_ALLOW_DESTRUCTIVE_MIGRATION !== m.name) {
      fail(`migration ${m.name} contains destructive statements (${hits.join(", ")}). Take a database backup/branch, review it, then deploy once with CMS_ALLOW_DESTRUCTIVE_MIGRATION=${m.name}.`);
    }
  }
}
const policy = process.env.CMS_MIGRATIONS ?? (dataEnv === "production" ? "check" : "apply");
if (!pending.length) ok(`schema up to date (${applied.size} migrations)`);
else if (policy !== "apply") {
  fail(`${pending.length} pending migration(s): ${pending.map((m) => m.name).join(", ")}. Production migrations are deliberate: take a backup, then deploy once with CMS_MIGRATIONS=apply (or run npm run cms:migrate against DATABASE_URL_UNPOOLED).`);
} else {
  console.info(`→ applying ${pending.length} migration(s): ${pending.map((m) => m.name).join(", ")}`);
  logEvent("info", "cms.migration.start", { pending: pending.map((m) => m.name), environment: dataEnv });
  // Exits non-zero (after rolling back the failing migration's transaction) on error.
  // The generated migration list is typed more narrowly than the adapter's parameter.
  await payload.db.migrate({ migrations: migrations as never });
  const after = new Set((await q(sql`select name from payload_migrations where batch > 0`)).map((r) => String(r.name)));
  const left = migrations.filter((m) => !after.has(m.name));
  if (left.length) fail(`migrations did not complete: ${left.map((m) => m.name).join(", ")}`);
  logEvent("info", "cms.migration.done", { applied: pending.map((m) => m.name) });
  ok(`applied ${pending.length} migration(s)`);
}

// 6. Bootstrap status.
const users = await payload.count({ collection: "users", overrideAccess: true });
const admins = await payload.count({ collection: "users", where: { role: { equals: "admin" } }, overrideAccess: true });
if (users.totalDocs === 0) {
  console.warn(`! No accounts yet. Create the first Admin (docs/DEPLOYMENT.md § Bootstrap)${process.env.CMS_BOOTSTRAP_TOKEN ? " — bootstrap window is OPEN at /admin/bootstrap" : ""}.`);
} else {
  ok(`${users.totalDocs} account(s), ${admins.totalDocs} Admin(s)`);
  if (process.env.CMS_BOOTSTRAP_TOKEN) console.warn("! CMS_BOOTSTRAP_TOKEN is still set. Accounts exist, so it no longer works — remove it from the environment.");
}
logEvent("info", "cms.preflight.ok", { environment: dataEnv, migrations: migrations.length, users: users.totalDocs });
process.exit(0);
