import path from "node:path";
import { fileURLToPath } from "node:url";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { s3Storage } from "@payloadcms/storage-s3";
import { buildConfig } from "payload";
import sharp from "sharp";
import { AuditLog } from "./cms/collections/AuditLog";
import { Capabilities } from "./cms/collections/Capabilities";
import { Insights } from "./cms/collections/Insights";
import { LegalPages } from "./cms/collections/LegalPages";
import { MarketStateEditions } from "./cms/collections/MarketStateEditions";
import { Media, MEDIA_MAX_BYTES } from "./cms/collections/Media";
import { NusantaraViews } from "./cms/collections/NusantaraViews";
import { Signals } from "./cms/collections/Signals";
import { Themes } from "./cms/collections/Themes";
import { Users } from "./cms/collections/Users";
import { SiteSettings } from "./cms/globals/SiteSettings";
import { checkCmsEnv, cmsOrigins, isDeployed } from "./cms/env";
import { logCmsError } from "./cms/hooks/observability";
import { logEvent, payloadLoggerOptions } from "./cms/log";

/**
 * Admin Portal (Payload CMS 3) — served by this Next.js app at /admin, with
 * its REST API at /api/cms. GraphQL is disabled. The public website does not
 * depend on it unless CONTENT_SOURCE=cms (src/lib/content/source.ts).
 *
 * Secrets come only from the environment (.env.example lists them). Nothing
 * here is a credential.
 */

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const serverURL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
/** Origins allowed to send authenticated (cookie) requests: CSRF + CORS (src/cms/env.ts). */
const allowedOrigins = cmsOrigins();

const s3Bucket = process.env.S3_BUCKET;

export default buildConfig({
  serverURL,
  secret: process.env.PAYLOAD_SECRET || "",
  telemetry: false,
  routes: { admin: "/admin", api: "/api/cms", graphQL: "/api/cms/graphql", graphQLPlayground: "/api/cms/graphql-playground" },
  graphQL: { disable: true, disablePlaygroundInProduction: true },
  csrf: allowedOrigins,
  cors: allowedOrigins,
  admin: {
    user: Users.slug,
    // Built-in avatar: Gravatar would send hashed staff emails to a third party (and is blocked by the CSP).
    avatar: "default",
    importMap: { baseDir: path.resolve(dirname) },
    meta: {
      titleSuffix: " · Nusantara Administration",
      robots: "noindex, nofollow",
      icons: [{ rel: "icon", type: "image/png", url: "/icon.png" }],
    },
    theme: "light",
    components: {
      graphics: { Logo: "/cms/admin/Branding#Logo", Icon: "/cms/admin/Branding#Icon" },
      afterLogin: ["/cms/admin/Branding#LoginHelp"],
      beforeDashboard: ["/cms/admin/EditorialDashboard#EditorialDashboard"],
    },
    dateFormat: "d MMM yyyy, HH:mm",
  },
  collections: [Insights, NusantaraViews, MarketStateEditions, Signals, Themes, Capabilities, LegalPages, Media, Users, AuditLog],
  globals: [SiteSettings],
  editor: lexicalEditor(),
  db: postgresAdapter({
    // Production: Neon's pooled (PgBouncer) endpoint with sslmode=require. Serverless
    // functions keep only a few connections each; Neon's pooler fans them in.
    pool: {
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.CMS_DB_POOL_MAX) || (isDeployed() ? 3 : 5),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    },
    // Schema changes go through reviewed migration files only — never auto-push.
    push: false,
    migrationDir: path.resolve(dirname, "cms/migrations"),
  }),
  sharp,
  upload: { limits: { fileSize: MEDIA_MAX_BYTES } },
  // Payload's own error logging, without database query parameters (they can hold unpublished content).
  logger: { options: payloadLoggerOptions },
  hooks: { afterError: [logCmsError] },
  onInit: async () => {
    const { problems, warnings, dataEnv } = checkCmsEnv();
    logEvent(problems.length ? "error" : "info", "cms.init", { environment: dataEnv, problems, warnings });
  },
  plugins: [
    s3Storage({
      // Always registered so the database schema is identical with and without S3
      // (alwaysInsertFields); it handles files only when S3_BUCKET is configured.
      enabled: !!s3Bucket,
      alwaysInsertFields: true,
      // Files are served through Payload's access-controlled route (never public bucket URLs);
      // the bucket keeps Block Public Access on and objects are private (no ACL).
      collections: { media: true },
      bucket: s3Bucket || "unconfigured",
      // Uploads go browser → S3 directly (signed for type and size), avoiding the hosting platform's request-size limit.
      clientUploads: true,
      config: {
        region: process.env.S3_REGION || "ap-southeast-1",
        // Local testing only: an S3-compatible endpoint (never set in Netlify).
        ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
        // Credentials from the environment's default AWS chain unless given explicitly.
        ...(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
          ? { credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } }
          : {}),
      },
    }),
  ],
  typescript: { outputFile: path.resolve(dirname, "cms/payload-types.ts") },
});
