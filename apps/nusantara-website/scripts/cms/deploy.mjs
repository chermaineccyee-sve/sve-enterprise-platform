// Admin Portal deploy step — runs before `next build` on Netlify (netlify.toml).
//
//   node scripts/cms/deploy.mjs
//
// • No DATABASE_URL: this deployment does not run the Admin Portal. Allowed only
//   while the public site reads local content (CONTENT_SOURCE=local).
// • Otherwise: the preflight (src/cms/scripts/preflight.ts) checks the
//   environment, database, data environment and migrations, applying
//   migrations only where the policy allows; then, if CMS_IMPORT_ON_DEPLOY=true,
//   the idempotent content import. Schema work uses DATABASE_URL_UNPOOLED
//   (Neon's direct connection) when it is set.
// Any failure exits non-zero, failing the build; Netlify keeps the previous
// deploy live.
import { spawnSync } from "node:child_process";

const env = { ...process.env };
const contentSource = env.CONTENT_SOURCE ?? "local";

if (!env.DATABASE_URL) {
  if (contentSource === "cms") {
    console.error("✗ CONTENT_SOURCE=cms needs the Admin Portal database (DATABASE_URL).");
    process.exit(1);
  }
  console.info("Admin Portal not configured for this deployment (no DATABASE_URL) — public site only, CONTENT_SOURCE=local.");
  process.exit(0);
}

const childEnv = { ...env, DATABASE_URL: env.DATABASE_URL_UNPOOLED || env.DATABASE_URL, CMS_RUNTIME_DATABASE_URL: env.DATABASE_URL };
function run(label, args) {
  console.info(`\n── ${label}`);
  const r = spawnSync("npx", ["payload", "run", ...args], { stdio: "inherit", env: childEnv });
  if (r.status !== 0) {
    console.error(`✗ ${label} failed (exit ${r.status}). The build stops here; the live deploy is unchanged.`);
    process.exit(r.status || 1);
  }
}

run("Admin Portal preflight", ["src/cms/scripts/preflight.ts"]);
if (env.CMS_IMPORT_ON_DEPLOY === "true") run("Content import (idempotent)", ["src/cms/scripts/import-content.ts"]);
console.info(`\nAdmin Portal ready. Public content source: ${contentSource}.`);
