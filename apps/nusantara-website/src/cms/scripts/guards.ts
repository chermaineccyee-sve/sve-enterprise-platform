import { sql } from "@payloadcms/db-postgres";
import type { Payload } from "payload";
import { dataEnvOf } from "../env";

/**
 * Test scripts create TEST accounts and TEST records. They run only against a
 * development database: CMS_DATA_ENV must be development and the database's
 * data-environment marker (set by the deploy preflight) must not say otherwise.
 */
export async function requireDevelopmentDatabase(payload: Payload, script: string) {
  const refuse = (why: string) => {
    console.error(`Refusing to run ${script}: ${why}. Test scripts create TEST accounts and records and run only against a development database.`);
    process.exit(1);
  };
  if (dataEnvOf() !== "development") refuse(`CMS_DATA_ENV is ${process.env.CMS_DATA_ENV ?? "unset"}`);
  const db = payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<{ rows: { value?: string }[] }> } };
  const [{ exists }] = (await db.drizzle.execute(sql`select to_regclass('public.nusantara_meta') is not null as exists`)).rows as unknown as { exists: boolean }[];
  if (!exists) return;
  const marker = (await db.drizzle.execute(sql`select value from nusantara_meta where key = 'data_environment'`)).rows[0]?.value;
  if (marker && marker !== "development") refuse(`this database belongs to the "${marker}" data environment`);
}
