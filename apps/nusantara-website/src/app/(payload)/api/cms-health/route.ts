import config from "@payload-config";
import { sql } from "@payloadcms/db-postgres";
import { getPayload } from "payload";
import { cmsConfigured, dataEnvOf } from "@/cms/env";
import { logEvent } from "@/cms/log";
import { migrations } from "@/cms/migrations";
import { contentSource } from "@/lib/content/source";

/**
 * GET /api/cms-health — for uptime checks and diagnosis. Reports only
 * aggregate state (no versions, hostnames, counts or names): whether the
 * Admin Portal is configured, the database answers, and the schema matches
 * this deployment's migrations. 200 when healthy, 503 otherwise.
 */
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET() {
  const base = { contentSource, dataEnvironment: dataEnvOf() ?? "unset" };
  if (!cmsConfigured()) return Response.json({ status: contentSource === "cms" ? "misconfigured" : "not-configured", ...base }, { status: contentSource === "cms" ? 503 : 200, headers });

  let database: "ok" | "unreachable" = "unreachable";
  let schema: "current" | "pending" | "unknown" = "unknown";
  try {
    const payload = await getPayload({ config });
    const db = payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<{ rows: { name: string }[] }> } };
    const { rows } = await db.drizzle.execute(sql`select name from payload_migrations where batch > 0`);
    database = "ok";
    const applied = new Set(rows.map((r) => r.name));
    schema = migrations.every((m) => applied.has(m.name)) ? "current" : "pending";
  } catch (err) {
    logEvent("error", "cms.db.unreachable", { phase: "health", error: err });
  }
  const healthy = database === "ok" && schema === "current";
  if (healthy === false && database === "ok") logEvent("error", "cms.schema.pending", {});
  return Response.json({ status: healthy ? "ok" : "degraded", database, schema, ...base }, { status: healthy ? 200 : 503, headers });
}
