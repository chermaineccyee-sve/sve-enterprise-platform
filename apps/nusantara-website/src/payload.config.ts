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
import { Media } from "./cms/collections/Media";
import { NusantaraViews } from "./cms/collections/NusantaraViews";
import { Signals } from "./cms/collections/Signals";
import { Themes } from "./cms/collections/Themes";
import { Users } from "./cms/collections/Users";
import { SiteSettings } from "./cms/globals/SiteSettings";

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
/** Origins allowed to send authenticated (cookie) requests: CSRF + CORS. */
const allowedOrigins = [serverURL, ...(process.env.CMS_EXTRA_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean)];

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
      titleSuffix: " · Nusantara Admin Portal",
      robots: "noindex, nofollow",
    },
    dateFormat: "d MMM yyyy, HH:mm",
  },
  collections: [Insights, NusantaraViews, MarketStateEditions, Signals, Themes, Capabilities, LegalPages, Media, Users, AuditLog],
  globals: [SiteSettings],
  editor: lexicalEditor(),
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL },
    // Schema changes go through reviewed migration files only — never auto-push.
    push: false,
    migrationDir: path.resolve(dirname, "cms/migrations"),
  }),
  sharp,
  upload: { limits: { fileSize: 10_000_000 } },
  plugins: s3Bucket
    ? [
        s3Storage({
          collections: { media: true },
          bucket: s3Bucket,
          // Uploads go browser → S3 directly (signed), avoiding the hosting platform's request-size limit.
          clientUploads: true,
          config: {
            region: process.env.S3_REGION || "ap-southeast-1",
            // Credentials from the environment's default AWS chain unless given explicitly.
            ...(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
              ? { credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } }
              : {}),
          },
        }),
      ]
    : [],
  typescript: { outputFile: path.resolve(dirname, "cms/payload-types.ts") },
});
