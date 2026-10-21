import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_audit_log_action" ADD VALUE 'discard' BEFORE 'delete';
  CREATE TABLE "insights_blocks_table_rows" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "insights_blocks_comparison_rows" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"left_text" varchar,
  	"right_text" varchar
  );
  
  CREATE TABLE "insights_blocks_chart_series" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"series_key" varchar,
  	"label" varchar
  );
  
  CREATE TABLE "insights_numbers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" numeric,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL
  );
  
  CREATE TABLE "_insights_v_blocks_table_rows" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_insights_v_blocks_comparison_rows" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"left_text" varchar,
  	"right_text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_insights_v_blocks_chart_series" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"series_key" varchar,
  	"label" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_insights_v_numbers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" numeric,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL
  );
  
  ALTER TABLE "insights_blocks_chart" ALTER COLUMN "decimals" SET DEFAULT 1;
  ALTER TABLE "_insights_v_blocks_chart" ALTER COLUMN "decimals" SET DEFAULT 1;
  ALTER TABLE "insights_blocks_scenario" ADD COLUMN "scenario_scenario_key" varchar;
  ALTER TABLE "insights_blocks_scenario" ADD COLUMN "scenario_title" varchar;
  ALTER TABLE "insights_blocks_scenario" ADD COLUMN "scenario_metric" varchar;
  ALTER TABLE "insights_blocks_scenario" ADD COLUMN "scenario_unit" varchar;
  ALTER TABLE "insights_blocks_scenario" ADD COLUMN "scenario_decimals" numeric DEFAULT 1;
  ALTER TABLE "insights_blocks_scenario" ADD COLUMN "scenario_base_year" numeric;
  ALTER TABLE "insights_blocks_scenario" ADD COLUMN "scenario_base_value" numeric;
  ALTER TABLE "insights_blocks_scenario" ADD COLUMN "scenario_downside_label" varchar;
  ALTER TABLE "insights_blocks_scenario" ADD COLUMN "scenario_downside_assumption" varchar;
  ALTER TABLE "insights_blocks_scenario" ADD COLUMN "scenario_downside_rate" numeric;
  ALTER TABLE "insights_blocks_scenario" ADD COLUMN "scenario_base_label" varchar;
  ALTER TABLE "insights_blocks_scenario" ADD COLUMN "scenario_base_assumption" varchar;
  ALTER TABLE "insights_blocks_scenario" ADD COLUMN "scenario_base_rate" numeric;
  ALTER TABLE "insights_blocks_scenario" ADD COLUMN "scenario_upside_label" varchar;
  ALTER TABLE "insights_blocks_scenario" ADD COLUMN "scenario_upside_assumption" varchar;
  ALTER TABLE "insights_blocks_scenario" ADD COLUMN "scenario_upside_rate" numeric;
  ALTER TABLE "insights_blocks_scenario" ADD COLUMN "scenario_period" varchar;
  ALTER TABLE "insights_blocks_scenario" ADD COLUMN "scenario_data_source" varchar;
  ALTER TABLE "insights_blocks_scenario" ADD COLUMN "scenario_methodology" varchar;
  ALTER TABLE "_insights_v_blocks_scenario" ADD COLUMN "scenario_scenario_key" varchar;
  ALTER TABLE "_insights_v_blocks_scenario" ADD COLUMN "scenario_title" varchar;
  ALTER TABLE "_insights_v_blocks_scenario" ADD COLUMN "scenario_metric" varchar;
  ALTER TABLE "_insights_v_blocks_scenario" ADD COLUMN "scenario_unit" varchar;
  ALTER TABLE "_insights_v_blocks_scenario" ADD COLUMN "scenario_decimals" numeric DEFAULT 1;
  ALTER TABLE "_insights_v_blocks_scenario" ADD COLUMN "scenario_base_year" numeric;
  ALTER TABLE "_insights_v_blocks_scenario" ADD COLUMN "scenario_base_value" numeric;
  ALTER TABLE "_insights_v_blocks_scenario" ADD COLUMN "scenario_downside_label" varchar;
  ALTER TABLE "_insights_v_blocks_scenario" ADD COLUMN "scenario_downside_assumption" varchar;
  ALTER TABLE "_insights_v_blocks_scenario" ADD COLUMN "scenario_downside_rate" numeric;
  ALTER TABLE "_insights_v_blocks_scenario" ADD COLUMN "scenario_base_label" varchar;
  ALTER TABLE "_insights_v_blocks_scenario" ADD COLUMN "scenario_base_assumption" varchar;
  ALTER TABLE "_insights_v_blocks_scenario" ADD COLUMN "scenario_base_rate" numeric;
  ALTER TABLE "_insights_v_blocks_scenario" ADD COLUMN "scenario_upside_label" varchar;
  ALTER TABLE "_insights_v_blocks_scenario" ADD COLUMN "scenario_upside_assumption" varchar;
  ALTER TABLE "_insights_v_blocks_scenario" ADD COLUMN "scenario_upside_rate" numeric;
  ALTER TABLE "_insights_v_blocks_scenario" ADD COLUMN "scenario_period" varchar;
  ALTER TABLE "_insights_v_blocks_scenario" ADD COLUMN "scenario_data_source" varchar;
  ALTER TABLE "_insights_v_blocks_scenario" ADD COLUMN "scenario_methodology" varchar;
  ALTER TABLE "insights_blocks_table_rows" ADD CONSTRAINT "insights_blocks_table_rows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."insights_blocks_table"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "insights_blocks_comparison_rows" ADD CONSTRAINT "insights_blocks_comparison_rows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."insights_blocks_comparison"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "insights_blocks_chart_series" ADD CONSTRAINT "insights_blocks_chart_series_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."insights_blocks_chart"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "insights_numbers" ADD CONSTRAINT "insights_numbers_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v_blocks_table_rows" ADD CONSTRAINT "_insights_v_blocks_table_rows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_insights_v_blocks_table"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v_blocks_comparison_rows" ADD CONSTRAINT "_insights_v_blocks_comparison_rows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_insights_v_blocks_comparison"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v_blocks_chart_series" ADD CONSTRAINT "_insights_v_blocks_chart_series_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_insights_v_blocks_chart"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_insights_v_numbers" ADD CONSTRAINT "_insights_v_numbers_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_insights_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "insights_blocks_table_rows_order_idx" ON "insights_blocks_table_rows" USING btree ("_order");
  CREATE INDEX "insights_blocks_table_rows_parent_id_idx" ON "insights_blocks_table_rows" USING btree ("_parent_id");
  CREATE INDEX "insights_blocks_comparison_rows_order_idx" ON "insights_blocks_comparison_rows" USING btree ("_order");
  CREATE INDEX "insights_blocks_comparison_rows_parent_id_idx" ON "insights_blocks_comparison_rows" USING btree ("_parent_id");
  CREATE INDEX "insights_blocks_chart_series_order_idx" ON "insights_blocks_chart_series" USING btree ("_order");
  CREATE INDEX "insights_blocks_chart_series_parent_id_idx" ON "insights_blocks_chart_series" USING btree ("_parent_id");
  CREATE INDEX "insights_numbers_order_parent_idx" ON "insights_numbers" USING btree ("order","parent_id");
  CREATE INDEX "_insights_v_blocks_table_rows_order_idx" ON "_insights_v_blocks_table_rows" USING btree ("_order");
  CREATE INDEX "_insights_v_blocks_table_rows_parent_id_idx" ON "_insights_v_blocks_table_rows" USING btree ("_parent_id");
  CREATE INDEX "_insights_v_blocks_comparison_rows_order_idx" ON "_insights_v_blocks_comparison_rows" USING btree ("_order");
  CREATE INDEX "_insights_v_blocks_comparison_rows_parent_id_idx" ON "_insights_v_blocks_comparison_rows" USING btree ("_parent_id");
  CREATE INDEX "_insights_v_blocks_chart_series_order_idx" ON "_insights_v_blocks_chart_series" USING btree ("_order");
  CREATE INDEX "_insights_v_blocks_chart_series_parent_id_idx" ON "_insights_v_blocks_chart_series" USING btree ("_parent_id");
  CREATE INDEX "_insights_v_numbers_order_parent_idx" ON "_insights_v_numbers" USING btree ("order","parent_id");
  ALTER TABLE "insights_blocks_table" DROP COLUMN "columns";
  ALTER TABLE "insights_blocks_table" DROP COLUMN "rows";
  ALTER TABLE "insights_blocks_comparison" DROP COLUMN "rows";
  ALTER TABLE "insights_blocks_chart" DROP COLUMN "x_labels";
  ALTER TABLE "insights_blocks_chart" DROP COLUMN "series";
  ALTER TABLE "insights_blocks_scenario" DROP COLUMN "scenario";
  ALTER TABLE "_insights_v_blocks_table" DROP COLUMN "columns";
  ALTER TABLE "_insights_v_blocks_table" DROP COLUMN "rows";
  ALTER TABLE "_insights_v_blocks_comparison" DROP COLUMN "rows";
  ALTER TABLE "_insights_v_blocks_chart" DROP COLUMN "x_labels";
  ALTER TABLE "_insights_v_blocks_chart" DROP COLUMN "series";
  ALTER TABLE "_insights_v_blocks_scenario" DROP COLUMN "scenario";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "insights_blocks_table_rows" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "insights_blocks_comparison_rows" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "insights_blocks_chart_series" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "insights_numbers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_insights_v_blocks_table_rows" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_insights_v_blocks_comparison_rows" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_insights_v_blocks_chart_series" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_insights_v_numbers" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "insights_blocks_table_rows" CASCADE;
  DROP TABLE "insights_blocks_comparison_rows" CASCADE;
  DROP TABLE "insights_blocks_chart_series" CASCADE;
  DROP TABLE "insights_numbers" CASCADE;
  DROP TABLE "_insights_v_blocks_table_rows" CASCADE;
  DROP TABLE "_insights_v_blocks_comparison_rows" CASCADE;
  DROP TABLE "_insights_v_blocks_chart_series" CASCADE;
  DROP TABLE "_insights_v_numbers" CASCADE;
  ALTER TABLE "audit_log" ALTER COLUMN "action" SET DATA TYPE text;
  DROP TYPE "public"."enum_audit_log_action";
  CREATE TYPE "public"."enum_audit_log_action" AS ENUM('create', 'edit', 'submit', 'approve', 'publish', 'archive', 'classify', 'restore', 'delete', 'user');
  ALTER TABLE "audit_log" ALTER COLUMN "action" SET DATA TYPE "public"."enum_audit_log_action" USING "action"::"public"."enum_audit_log_action";
  ALTER TABLE "insights_blocks_chart" ALTER COLUMN "decimals" DROP DEFAULT;
  ALTER TABLE "_insights_v_blocks_chart" ALTER COLUMN "decimals" DROP DEFAULT;
  ALTER TABLE "insights_blocks_table" ADD COLUMN "columns" jsonb;
  ALTER TABLE "insights_blocks_table" ADD COLUMN "rows" jsonb;
  ALTER TABLE "insights_blocks_comparison" ADD COLUMN "rows" jsonb;
  ALTER TABLE "insights_blocks_chart" ADD COLUMN "x_labels" jsonb;
  ALTER TABLE "insights_blocks_chart" ADD COLUMN "series" jsonb;
  ALTER TABLE "insights_blocks_scenario" ADD COLUMN "scenario" jsonb;
  ALTER TABLE "_insights_v_blocks_table" ADD COLUMN "columns" jsonb;
  ALTER TABLE "_insights_v_blocks_table" ADD COLUMN "rows" jsonb;
  ALTER TABLE "_insights_v_blocks_comparison" ADD COLUMN "rows" jsonb;
  ALTER TABLE "_insights_v_blocks_chart" ADD COLUMN "x_labels" jsonb;
  ALTER TABLE "_insights_v_blocks_chart" ADD COLUMN "series" jsonb;
  ALTER TABLE "_insights_v_blocks_scenario" ADD COLUMN "scenario" jsonb;
  ALTER TABLE "insights_blocks_scenario" DROP COLUMN "scenario_scenario_key";
  ALTER TABLE "insights_blocks_scenario" DROP COLUMN "scenario_title";
  ALTER TABLE "insights_blocks_scenario" DROP COLUMN "scenario_metric";
  ALTER TABLE "insights_blocks_scenario" DROP COLUMN "scenario_unit";
  ALTER TABLE "insights_blocks_scenario" DROP COLUMN "scenario_decimals";
  ALTER TABLE "insights_blocks_scenario" DROP COLUMN "scenario_base_year";
  ALTER TABLE "insights_blocks_scenario" DROP COLUMN "scenario_base_value";
  ALTER TABLE "insights_blocks_scenario" DROP COLUMN "scenario_downside_label";
  ALTER TABLE "insights_blocks_scenario" DROP COLUMN "scenario_downside_assumption";
  ALTER TABLE "insights_blocks_scenario" DROP COLUMN "scenario_downside_rate";
  ALTER TABLE "insights_blocks_scenario" DROP COLUMN "scenario_base_label";
  ALTER TABLE "insights_blocks_scenario" DROP COLUMN "scenario_base_assumption";
  ALTER TABLE "insights_blocks_scenario" DROP COLUMN "scenario_base_rate";
  ALTER TABLE "insights_blocks_scenario" DROP COLUMN "scenario_upside_label";
  ALTER TABLE "insights_blocks_scenario" DROP COLUMN "scenario_upside_assumption";
  ALTER TABLE "insights_blocks_scenario" DROP COLUMN "scenario_upside_rate";
  ALTER TABLE "insights_blocks_scenario" DROP COLUMN "scenario_period";
  ALTER TABLE "insights_blocks_scenario" DROP COLUMN "scenario_data_source";
  ALTER TABLE "insights_blocks_scenario" DROP COLUMN "scenario_methodology";
  ALTER TABLE "_insights_v_blocks_scenario" DROP COLUMN "scenario_scenario_key";
  ALTER TABLE "_insights_v_blocks_scenario" DROP COLUMN "scenario_title";
  ALTER TABLE "_insights_v_blocks_scenario" DROP COLUMN "scenario_metric";
  ALTER TABLE "_insights_v_blocks_scenario" DROP COLUMN "scenario_unit";
  ALTER TABLE "_insights_v_blocks_scenario" DROP COLUMN "scenario_decimals";
  ALTER TABLE "_insights_v_blocks_scenario" DROP COLUMN "scenario_base_year";
  ALTER TABLE "_insights_v_blocks_scenario" DROP COLUMN "scenario_base_value";
  ALTER TABLE "_insights_v_blocks_scenario" DROP COLUMN "scenario_downside_label";
  ALTER TABLE "_insights_v_blocks_scenario" DROP COLUMN "scenario_downside_assumption";
  ALTER TABLE "_insights_v_blocks_scenario" DROP COLUMN "scenario_downside_rate";
  ALTER TABLE "_insights_v_blocks_scenario" DROP COLUMN "scenario_base_label";
  ALTER TABLE "_insights_v_blocks_scenario" DROP COLUMN "scenario_base_assumption";
  ALTER TABLE "_insights_v_blocks_scenario" DROP COLUMN "scenario_base_rate";
  ALTER TABLE "_insights_v_blocks_scenario" DROP COLUMN "scenario_upside_label";
  ALTER TABLE "_insights_v_blocks_scenario" DROP COLUMN "scenario_upside_assumption";
  ALTER TABLE "_insights_v_blocks_scenario" DROP COLUMN "scenario_upside_rate";
  ALTER TABLE "_insights_v_blocks_scenario" DROP COLUMN "scenario_period";
  ALTER TABLE "_insights_v_blocks_scenario" DROP COLUMN "scenario_data_source";
  ALTER TABLE "_insights_v_blocks_scenario" DROP COLUMN "scenario_methodology";`)
}
