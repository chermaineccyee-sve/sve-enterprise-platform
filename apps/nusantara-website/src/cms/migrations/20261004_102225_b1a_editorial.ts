import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_audit_log_action" ADD VALUE 'restore' BEFORE 'delete';
  CREATE TABLE "nusantara_views_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"capabilities_id" integer
  );
  
  CREATE TABLE "_nusantara_views_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"capabilities_id" integer
  );
  
  CREATE TABLE "market_state_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"capabilities_id" integer
  );
  
  CREATE TABLE "_market_state_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"capabilities_id" integer
  );
  
  ALTER TABLE "insights_indicators" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_insights_v_version_indicators" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "insights_indicators" CASCADE;
  DROP TABLE "_insights_v_version_indicators" CASCADE;
  ALTER TABLE "nusantara_views" DROP CONSTRAINT "nusantara_views_theme_id_themes_id_fk";
  
  ALTER TABLE "_nusantara_views_v" DROP CONSTRAINT "_nusantara_views_v_version_theme_id_themes_id_fk";
  
  DROP INDEX "nusantara_views_theme_idx";
  DROP INDEX "_nusantara_views_v_version_version_theme_idx";
  ALTER TABLE "insights" ADD COLUMN "display_order" numeric DEFAULT 1000;
  ALTER TABLE "insights" ADD COLUMN "revised_at" timestamp(3) with time zone;
  ALTER TABLE "_insights_v" ADD COLUMN "version_display_order" numeric DEFAULT 1000;
  ALTER TABLE "_insights_v" ADD COLUMN "version_revised_at" timestamp(3) with time zone;
  ALTER TABLE "nusantara_views" ADD COLUMN "theme" varchar;
  ALTER TABLE "nusantara_views" ADD COLUMN "display_order" numeric DEFAULT 1000;
  ALTER TABLE "nusantara_views" ADD COLUMN "revised_at" timestamp(3) with time zone;
  ALTER TABLE "_nusantara_views_v" ADD COLUMN "version_theme" varchar;
  ALTER TABLE "_nusantara_views_v" ADD COLUMN "version_display_order" numeric DEFAULT 1000;
  ALTER TABLE "_nusantara_views_v" ADD COLUMN "version_revised_at" timestamp(3) with time zone;
  ALTER TABLE "market_state" ADD COLUMN "display_order" numeric DEFAULT 1000;
  ALTER TABLE "market_state" ADD COLUMN "revised_at" timestamp(3) with time zone;
  ALTER TABLE "_market_state_v" ADD COLUMN "version_display_order" numeric DEFAULT 1000;
  ALTER TABLE "_market_state_v" ADD COLUMN "version_revised_at" timestamp(3) with time zone;
  ALTER TABLE "signals" ADD COLUMN "display_order" numeric DEFAULT 1000;
  ALTER TABLE "signals" ADD COLUMN "revised_at" timestamp(3) with time zone;
  ALTER TABLE "_signals_v" ADD COLUMN "version_display_order" numeric DEFAULT 1000;
  ALTER TABLE "_signals_v" ADD COLUMN "version_revised_at" timestamp(3) with time zone;
  ALTER TABLE "themes" ADD COLUMN "display_order" numeric DEFAULT 1000;
  ALTER TABLE "themes" ADD COLUMN "revised_at" timestamp(3) with time zone;
  ALTER TABLE "_themes_v" ADD COLUMN "version_display_order" numeric DEFAULT 1000;
  ALTER TABLE "_themes_v" ADD COLUMN "version_revised_at" timestamp(3) with time zone;
  ALTER TABLE "capabilities" ADD COLUMN "display_order" numeric DEFAULT 1000;
  ALTER TABLE "capabilities" ADD COLUMN "revised_at" timestamp(3) with time zone;
  ALTER TABLE "_capabilities_v" ADD COLUMN "version_display_order" numeric DEFAULT 1000;
  ALTER TABLE "_capabilities_v" ADD COLUMN "version_revised_at" timestamp(3) with time zone;
  ALTER TABLE "legal_pages" ADD COLUMN "display_order" numeric DEFAULT 1000;
  ALTER TABLE "legal_pages" ADD COLUMN "revised_at" timestamp(3) with time zone;
  ALTER TABLE "_legal_pages_v" ADD COLUMN "version_display_order" numeric DEFAULT 1000;
  ALTER TABLE "_legal_pages_v" ADD COLUMN "version_revised_at" timestamp(3) with time zone;
  ALTER TABLE "nusantara_views_rels" ADD CONSTRAINT "nusantara_views_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."nusantara_views"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "nusantara_views_rels" ADD CONSTRAINT "nusantara_views_rels_capabilities_fk" FOREIGN KEY ("capabilities_id") REFERENCES "public"."capabilities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_nusantara_views_v_rels" ADD CONSTRAINT "_nusantara_views_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_nusantara_views_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_nusantara_views_v_rels" ADD CONSTRAINT "_nusantara_views_v_rels_capabilities_fk" FOREIGN KEY ("capabilities_id") REFERENCES "public"."capabilities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "market_state_rels" ADD CONSTRAINT "market_state_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."market_state"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "market_state_rels" ADD CONSTRAINT "market_state_rels_capabilities_fk" FOREIGN KEY ("capabilities_id") REFERENCES "public"."capabilities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_market_state_v_rels" ADD CONSTRAINT "_market_state_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_market_state_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_market_state_v_rels" ADD CONSTRAINT "_market_state_v_rels_capabilities_fk" FOREIGN KEY ("capabilities_id") REFERENCES "public"."capabilities"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "nusantara_views_rels_order_idx" ON "nusantara_views_rels" USING btree ("order");
  CREATE INDEX "nusantara_views_rels_parent_idx" ON "nusantara_views_rels" USING btree ("parent_id");
  CREATE INDEX "nusantara_views_rels_path_idx" ON "nusantara_views_rels" USING btree ("path");
  CREATE INDEX "nusantara_views_rels_capabilities_id_idx" ON "nusantara_views_rels" USING btree ("capabilities_id");
  CREATE INDEX "_nusantara_views_v_rels_order_idx" ON "_nusantara_views_v_rels" USING btree ("order");
  CREATE INDEX "_nusantara_views_v_rels_parent_idx" ON "_nusantara_views_v_rels" USING btree ("parent_id");
  CREATE INDEX "_nusantara_views_v_rels_path_idx" ON "_nusantara_views_v_rels" USING btree ("path");
  CREATE INDEX "_nusantara_views_v_rels_capabilities_id_idx" ON "_nusantara_views_v_rels" USING btree ("capabilities_id");
  CREATE INDEX "market_state_rels_order_idx" ON "market_state_rels" USING btree ("order");
  CREATE INDEX "market_state_rels_parent_idx" ON "market_state_rels" USING btree ("parent_id");
  CREATE INDEX "market_state_rels_path_idx" ON "market_state_rels" USING btree ("path");
  CREATE INDEX "market_state_rels_capabilities_id_idx" ON "market_state_rels" USING btree ("capabilities_id");
  CREATE INDEX "_market_state_v_rels_order_idx" ON "_market_state_v_rels" USING btree ("order");
  CREATE INDEX "_market_state_v_rels_parent_idx" ON "_market_state_v_rels" USING btree ("parent_id");
  CREATE INDEX "_market_state_v_rels_path_idx" ON "_market_state_v_rels" USING btree ("path");
  CREATE INDEX "_market_state_v_rels_capabilities_id_idx" ON "_market_state_v_rels" USING btree ("capabilities_id");
  CREATE INDEX "insights_display_order_idx" ON "insights" USING btree ("display_order");
  CREATE INDEX "_insights_v_version_version_display_order_idx" ON "_insights_v" USING btree ("version_display_order");
  CREATE INDEX "nusantara_views_display_order_idx" ON "nusantara_views" USING btree ("display_order");
  CREATE INDEX "_nusantara_views_v_version_version_display_order_idx" ON "_nusantara_views_v" USING btree ("version_display_order");
  CREATE INDEX "market_state_display_order_idx" ON "market_state" USING btree ("display_order");
  CREATE INDEX "_market_state_v_version_version_display_order_idx" ON "_market_state_v" USING btree ("version_display_order");
  CREATE INDEX "signals_display_order_idx" ON "signals" USING btree ("display_order");
  CREATE INDEX "_signals_v_version_version_display_order_idx" ON "_signals_v" USING btree ("version_display_order");
  CREATE INDEX "themes_display_order_idx" ON "themes" USING btree ("display_order");
  CREATE INDEX "_themes_v_version_version_display_order_idx" ON "_themes_v" USING btree ("version_display_order");
  CREATE INDEX "capabilities_display_order_idx" ON "capabilities" USING btree ("display_order");
  CREATE INDEX "_capabilities_v_version_version_display_order_idx" ON "_capabilities_v" USING btree ("version_display_order");
  CREATE INDEX "legal_pages_display_order_idx" ON "legal_pages" USING btree ("display_order");
  CREATE INDEX "_legal_pages_v_version_version_display_order_idx" ON "_legal_pages_v" USING btree ("version_display_order");
  ALTER TABLE "nusantara_views" DROP COLUMN "theme_id";
  ALTER TABLE "_nusantara_views_v" DROP COLUMN "version_theme_id";
  DROP TYPE "public"."enum_insights_indicators";
  DROP TYPE "public"."enum__insights_v_version_indicators";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_insights_indicators" AS ENUM('am-assets', 'am-alt-share', 'pm-fundraising', 'pm-undeployed', 'pm-credit', 'alt-real-assets', 'alt-precious', 'cf-portfolio', 'cf-direct', 'pw-pool', 'pw-advised', 'fo-formation', 'inst-alts', 'macro-growth', 'macro-inflation', 'macro-policy');
  CREATE TYPE "public"."enum__insights_v_version_indicators" AS ENUM('am-assets', 'am-alt-share', 'pm-fundraising', 'pm-undeployed', 'pm-credit', 'alt-real-assets', 'alt-precious', 'cf-portfolio', 'cf-direct', 'pw-pool', 'pw-advised', 'fo-formation', 'inst-alts', 'macro-growth', 'macro-inflation', 'macro-policy');
  CREATE TABLE "insights_indicators" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_insights_indicators",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_insights_v_version_indicators" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__insights_v_version_indicators",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  ALTER TABLE "nusantara_views_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_nusantara_views_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "market_state_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_market_state_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "nusantara_views_rels" CASCADE;
  DROP TABLE "_nusantara_views_v_rels" CASCADE;
  DROP TABLE "market_state_rels" CASCADE;
  DROP TABLE "_market_state_v_rels" CASCADE;
  ALTER TABLE "audit_log" ALTER COLUMN "action" SET DATA TYPE text;
  DROP TYPE "public"."enum_audit_log_action";
  CREATE TYPE "public"."enum_audit_log_action" AS ENUM('create', 'edit', 'submit', 'approve', 'publish', 'archive', 'classify', 'delete', 'user');
  ALTER TABLE "audit_log" ALTER COLUMN "action" SET DATA TYPE "public"."enum_audit_log_action" USING "action"::"public"."enum_audit_log_action";
  DROP INDEX "insights_display_order_idx";
  DROP INDEX "_insights_v_version_version_display_order_idx";
  DROP INDEX "nusantara_views_display_order_idx";
  DROP INDEX "_nusantara_views_v_version_version_display_order_idx";
  DROP INDEX "market_state_display_order_idx";
  DROP INDEX "_market_state_v_version_version_display_order_idx";
  DROP INDEX "signals_display_order_idx";
  DROP INDEX "_signals_v_version_version_display_order_idx";
  DROP INDEX "themes_display_order_idx";
  DROP INDEX "_themes_v_version_version_display_order_idx";
  DROP INDEX "capabilities_display_order_idx";
  DROP INDEX "_capabilities_v_version_version_display_order_idx";
  DROP INDEX "legal_pages_display_order_idx";
  DROP INDEX "_legal_pages_v_version_version_display_order_idx";
  ALTER TABLE "nusantara_views" ADD COLUMN "theme_id" integer;
  ALTER TABLE "_nusantara_views_v" ADD COLUMN "version_theme_id" integer;
  ALTER TABLE "insights_indicators" ADD CONSTRAINT "insights_indicators_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v_version_indicators" ADD CONSTRAINT "_insights_v_version_indicators_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_insights_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "insights_indicators_order_idx" ON "insights_indicators" USING btree ("order");
  CREATE INDEX "insights_indicators_parent_idx" ON "insights_indicators" USING btree ("parent_id");
  CREATE INDEX "_insights_v_version_indicators_order_idx" ON "_insights_v_version_indicators" USING btree ("order");
  CREATE INDEX "_insights_v_version_indicators_parent_idx" ON "_insights_v_version_indicators" USING btree ("parent_id");
  ALTER TABLE "nusantara_views" ADD CONSTRAINT "nusantara_views_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_nusantara_views_v" ADD CONSTRAINT "_nusantara_views_v_version_theme_id_themes_id_fk" FOREIGN KEY ("version_theme_id") REFERENCES "public"."themes"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "nusantara_views_theme_idx" ON "nusantara_views" USING btree ("theme_id");
  CREATE INDEX "_nusantara_views_v_version_version_theme_idx" ON "_nusantara_views_v" USING btree ("version_theme_id");
  ALTER TABLE "insights" DROP COLUMN "display_order";
  ALTER TABLE "insights" DROP COLUMN "revised_at";
  ALTER TABLE "_insights_v" DROP COLUMN "version_display_order";
  ALTER TABLE "_insights_v" DROP COLUMN "version_revised_at";
  ALTER TABLE "nusantara_views" DROP COLUMN "theme";
  ALTER TABLE "nusantara_views" DROP COLUMN "display_order";
  ALTER TABLE "nusantara_views" DROP COLUMN "revised_at";
  ALTER TABLE "_nusantara_views_v" DROP COLUMN "version_theme";
  ALTER TABLE "_nusantara_views_v" DROP COLUMN "version_display_order";
  ALTER TABLE "_nusantara_views_v" DROP COLUMN "version_revised_at";
  ALTER TABLE "market_state" DROP COLUMN "display_order";
  ALTER TABLE "market_state" DROP COLUMN "revised_at";
  ALTER TABLE "_market_state_v" DROP COLUMN "version_display_order";
  ALTER TABLE "_market_state_v" DROP COLUMN "version_revised_at";
  ALTER TABLE "signals" DROP COLUMN "display_order";
  ALTER TABLE "signals" DROP COLUMN "revised_at";
  ALTER TABLE "_signals_v" DROP COLUMN "version_display_order";
  ALTER TABLE "_signals_v" DROP COLUMN "version_revised_at";
  ALTER TABLE "themes" DROP COLUMN "display_order";
  ALTER TABLE "themes" DROP COLUMN "revised_at";
  ALTER TABLE "_themes_v" DROP COLUMN "version_display_order";
  ALTER TABLE "_themes_v" DROP COLUMN "version_revised_at";
  ALTER TABLE "capabilities" DROP COLUMN "display_order";
  ALTER TABLE "capabilities" DROP COLUMN "revised_at";
  ALTER TABLE "_capabilities_v" DROP COLUMN "version_display_order";
  ALTER TABLE "_capabilities_v" DROP COLUMN "version_revised_at";
  ALTER TABLE "legal_pages" DROP COLUMN "display_order";
  ALTER TABLE "legal_pages" DROP COLUMN "revised_at";
  ALTER TABLE "_legal_pages_v" DROP COLUMN "version_display_order";
  ALTER TABLE "_legal_pages_v" DROP COLUMN "version_revised_at";`)
}
