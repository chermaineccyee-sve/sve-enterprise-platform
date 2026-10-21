import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_ms_dim_markets" AS ENUM('klci', 'sti', 'jci', 'nikkei', 'hsi', 'spx', 'nasdaq', 'usdmyr', 'usdsgd', 'usdidr', 'sgdmyr', 'eurusd', 'usdcnh', 'usdjpy', 'us10y', 'us2y', 'mgs10y', 'jgb10y', 'sgs10y', 'gold', 'silver', 'brent', 'cpo', 'copper');
  CREATE TABLE "ms_dim_markets" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "enum_ms_dim_markets",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_ms_dim_markets_v" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_ms_dim_markets",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  DROP TABLE "_markets_v" CASCADE;
  ALTER TABLE "ms_dim_markets" ADD CONSTRAINT "ms_dim_markets_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."market_state_dimensions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_ms_dim_markets_v" ADD CONSTRAINT "_ms_dim_markets_v_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_market_state_v_version_dimensions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "ms_dim_markets_order_idx" ON "ms_dim_markets" USING btree ("order");
  CREATE INDEX "ms_dim_markets_parent_idx" ON "ms_dim_markets" USING btree ("parent_id");
  CREATE INDEX "_ms_dim_markets_v_order_idx" ON "_ms_dim_markets_v" USING btree ("order");
  CREATE INDEX "_ms_dim_markets_v_parent_idx" ON "_ms_dim_markets_v" USING btree ("parent_id");
  DROP TYPE "public"."markets";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."markets" AS ENUM('klci', 'sti', 'jci', 'nikkei', 'hsi', 'spx', 'nasdaq', 'usdmyr', 'usdsgd', 'usdidr', 'sgdmyr', 'eurusd', 'usdcnh', 'usdjpy', 'us10y', 'us2y', 'mgs10y', 'jgb10y', 'sgs10y', 'gold', 'silver', 'brent', 'cpo', 'copper');
  CREATE TABLE "_markets_v" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "markets",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  DROP TABLE "ms_dim_markets" CASCADE;
  DROP TABLE "_ms_dim_markets_v" CASCADE;
  ALTER TABLE "_markets_v" ADD CONSTRAINT "_markets_v_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_market_state_v_version_dimensions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "_markets_v_order_idx" ON "_markets_v" USING btree ("order");
  CREATE INDEX "_markets_v_parent_idx" ON "_markets_v" USING btree ("parent_id");
  DROP TYPE "public"."enum_ms_dim_markets";`)
}
