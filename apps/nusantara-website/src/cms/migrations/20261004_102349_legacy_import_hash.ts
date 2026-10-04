import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "insights" ADD COLUMN "legacy_import_hash" varchar;
  ALTER TABLE "_insights_v" ADD COLUMN "version_legacy_import_hash" varchar;
  ALTER TABLE "nusantara_views" ADD COLUMN "legacy_import_hash" varchar;
  ALTER TABLE "_nusantara_views_v" ADD COLUMN "version_legacy_import_hash" varchar;
  ALTER TABLE "market_state" ADD COLUMN "legacy_import_hash" varchar;
  ALTER TABLE "_market_state_v" ADD COLUMN "version_legacy_import_hash" varchar;
  ALTER TABLE "signals" ADD COLUMN "legacy_import_hash" varchar;
  ALTER TABLE "_signals_v" ADD COLUMN "version_legacy_import_hash" varchar;
  ALTER TABLE "themes" ADD COLUMN "legacy_import_hash" varchar;
  ALTER TABLE "_themes_v" ADD COLUMN "version_legacy_import_hash" varchar;
  ALTER TABLE "capabilities" ADD COLUMN "legacy_import_hash" varchar;
  ALTER TABLE "_capabilities_v" ADD COLUMN "version_legacy_import_hash" varchar;
  ALTER TABLE "legal_pages" ADD COLUMN "legacy_import_hash" varchar;
  ALTER TABLE "_legal_pages_v" ADD COLUMN "version_legacy_import_hash" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "insights" DROP COLUMN "legacy_import_hash";
  ALTER TABLE "_insights_v" DROP COLUMN "version_legacy_import_hash";
  ALTER TABLE "nusantara_views" DROP COLUMN "legacy_import_hash";
  ALTER TABLE "_nusantara_views_v" DROP COLUMN "version_legacy_import_hash";
  ALTER TABLE "market_state" DROP COLUMN "legacy_import_hash";
  ALTER TABLE "_market_state_v" DROP COLUMN "version_legacy_import_hash";
  ALTER TABLE "signals" DROP COLUMN "legacy_import_hash";
  ALTER TABLE "_signals_v" DROP COLUMN "version_legacy_import_hash";
  ALTER TABLE "themes" DROP COLUMN "legacy_import_hash";
  ALTER TABLE "_themes_v" DROP COLUMN "version_legacy_import_hash";
  ALTER TABLE "capabilities" DROP COLUMN "legacy_import_hash";
  ALTER TABLE "_capabilities_v" DROP COLUMN "version_legacy_import_hash";
  ALTER TABLE "legal_pages" DROP COLUMN "legacy_import_hash";
  ALTER TABLE "_legal_pages_v" DROP COLUMN "version_legacy_import_hash";`)
}
