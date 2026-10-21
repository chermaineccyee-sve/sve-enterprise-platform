/**
 * Admin Portal environment rules — one place, used by the deploy preflight
 * (which fails the build on any problem) and at runtime (which logs them).
 * Messages name variables, never their values.
 *
 * CMS_DATA_ENV says which data set a deployment is allowed to touch:
 *   production  — the real editorial database and media bucket;
 *   preview     — a separate database branch and bucket for branch/deploy previews;
 *   development — a developer's local database.
 * The deploy preflight records it in the database on first use and refuses
 * any later deployment whose CMS_DATA_ENV differs (src/cms/scripts/preflight.ts).
 */
export const DATA_ENVS = ["production", "preview", "development"] as const;
export type DataEnv = (typeof DATA_ENVS)[number];

type Env = Record<string, string | undefined>;

/** True on Netlify builds and functions (Netlify sets NETLIFY=true / CONTEXT). */
export const isDeployed = (e: Env = process.env) => e.NETLIFY === "true" || !!e.CONTEXT;

export function dataEnvOf(e: Env = process.env): DataEnv | undefined {
  const v = e.CMS_DATA_ENV ?? (isDeployed(e) ? undefined : "development");
  return (DATA_ENVS as readonly string[]).includes(v ?? "") ? (v as DataEnv) : undefined;
}

/** The Admin Portal is enabled in a deployment only when it has a database and a secret. */
export const cmsConfigured = (e: Env = process.env) => !!e.DATABASE_URL && !!e.PAYLOAD_SECRET;

const sslRequired = (url: string) => /[?&]sslmode=(require|verify-ca|verify-full)\b/.test(url);
/** https://, or plain http on this machine only (local runs of the Netlify tooling). */
const isHttps = (u: string) => {
  try {
    const url = new URL(u);
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
  } catch {
    return false;
  }
};

export function checkCmsEnv(e: Env = process.env): { problems: string[]; warnings: string[]; dataEnv?: DataEnv } {
  const problems: string[] = [];
  const warnings: string[] = [];
  const deployed = isDeployed(e);
  const dataEnv = dataEnvOf(e);

  if (!e.PAYLOAD_SECRET) problems.push("PAYLOAD_SECRET is not set.");
  else if (e.PAYLOAD_SECRET.length < 32) problems.push("PAYLOAD_SECRET must be at least 32 characters (use `openssl rand -hex 32`).");

  if (!e.DATABASE_URL) problems.push("DATABASE_URL is not set.");
  else if (!/^postgres(ql)?:\/\//.test(e.DATABASE_URL)) problems.push("DATABASE_URL must be a postgres:// connection string.");
  if (e.DATABASE_URL_UNPOOLED && !/^postgres(ql)?:\/\//.test(e.DATABASE_URL_UNPOOLED)) problems.push("DATABASE_URL_UNPOOLED must be a postgres:// connection string.");

  if (!dataEnv) problems.push(`CMS_DATA_ENV must be one of ${DATA_ENVS.join(", ")}${deployed ? " (required in deployments)" : ""}.`);

  // Netlify deploy context ↔ data environment.
  if (e.CONTEXT === "production" && dataEnv && dataEnv !== "production") problems.push("The production deploy context must use CMS_DATA_ENV=production.");
  if ((e.CONTEXT === "deploy-preview" || e.CONTEXT === "branch-deploy") && dataEnv === "production")
    problems.push("Deploy previews and branch deploys must not use CMS_DATA_ENV=production (use a separate preview database).");

  if (dataEnv === "production" || dataEnv === "preview" || deployed) {
    for (const k of ["DATABASE_URL", "DATABASE_URL_UNPOOLED"]) {
      const v = e[k];
      if (v && !sslRequired(v)) problems.push(`${k} must require TLS (add sslmode=require or sslmode=verify-full).`);
    }
    // Serverless functions each hold their own small pool, and frozen instances keep idle
    // connections open; Neon's pooled endpoint (PgBouncer, host "-pooler") absorbs that.
    // (The deploy step runs schema work on the direct URL and passes the runtime one as CMS_RUNTIME_DATABASE_URL.)
    const runtimeUrl = e.CMS_RUNTIME_DATABASE_URL ?? e.DATABASE_URL;
    if (runtimeUrl && /\.neon\.tech/.test(runtimeUrl) && !/-pooler\./.test(runtimeUrl))
      problems.push("DATABASE_URL must be Neon's pooled connection (host contains -pooler); use the direct connection only for DATABASE_URL_UNPOOLED.");
    if (e.DATABASE_URL_UNPOOLED && /-pooler\./.test(e.DATABASE_URL_UNPOOLED)) problems.push("DATABASE_URL_UNPOOLED must be Neon's direct connection (host without -pooler).");
    if (!e.DATABASE_URL_UNPOOLED) warnings.push("DATABASE_URL_UNPOOLED is not set; migrations will use DATABASE_URL (use Neon's direct, non-pooled connection for migrations).");
    if (!e.NEXT_PUBLIC_SITE_URL || !isHttps(e.NEXT_PUBLIC_SITE_URL)) problems.push("NEXT_PUBLIC_SITE_URL must be the deployment's https:// origin.");
    for (const o of (e.CMS_EXTRA_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
      if (!isHttps(o)) problems.push("Every CMS_EXTRA_ORIGINS entry must be an https:// origin.");
    }
    if (deployed && !e.S3_BUCKET) problems.push("S3_BUCKET is not set: deployed functions have no persistent disk, so uploads would be lost.");
  }

  if (e.S3_BUCKET) {
    if (!e.S3_REGION) warnings.push("S3_REGION is not set; ap-southeast-1 is assumed.");
    if (!!e.S3_ACCESS_KEY_ID !== !!e.S3_SECRET_ACCESS_KEY) problems.push("Set both S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY, or neither.");
  }

  if (e.CMS_ALLOW_FIRST_USER) warnings.push("CMS_ALLOW_FIRST_USER is no longer used; the first Admin is created with CMS_BOOTSTRAP_TOKEN or `npm run cms:seed-admin`.");
  if (e.CMS_BOOTSTRAP_TOKEN && e.CMS_BOOTSTRAP_TOKEN.length < 32) problems.push("CMS_BOOTSTRAP_TOKEN must be at least 32 characters (use `openssl rand -hex 32`).");

  if (e.CMS_MIGRATIONS && !["check", "apply"].includes(e.CMS_MIGRATIONS)) problems.push("CMS_MIGRATIONS must be check or apply.");

  return { problems, warnings, dataEnv };
}

/**
 * Origins allowed to send authenticated (cookie) requests to the Admin Portal
 * (CSRF + CORS): the site's own origin, CMS_EXTRA_ORIGINS and — outside
 * production — the Netlify deploy's own URLs captured at build (next.config.ts).
 */
export function cmsOrigins(e: Env = process.env): string[] {
  const list = (v?: string) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const site = e.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return [...new Set([site, ...list(e.CMS_EXTRA_ORIGINS), ...(dataEnvOf(e) === "production" ? [] : list(e.NUSANTARA_DEPLOY_ORIGINS))])];
}
