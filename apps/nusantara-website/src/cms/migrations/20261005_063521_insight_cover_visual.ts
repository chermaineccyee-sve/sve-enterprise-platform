import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_insights_cover_type" AS ENUM('abstract', 'image', 'research');
  CREATE TYPE "public"."enum__insights_v_version_cover_type" AS ENUM('abstract', 'image', 'research');
  ALTER TABLE "insights" ADD COLUMN "cover_type" "enum_insights_cover_type" DEFAULT 'abstract';
  ALTER TABLE "insights" ADD COLUMN "cover_image_id" integer;
  ALTER TABLE "insights" ADD COLUMN "cover_caption" varchar;
  ALTER TABLE "_insights_v" ADD COLUMN "version_cover_type" "enum__insights_v_version_cover_type" DEFAULT 'abstract';
  ALTER TABLE "_insights_v" ADD COLUMN "version_cover_image_id" integer;
  ALTER TABLE "_insights_v" ADD COLUMN "version_cover_caption" varchar;
  ALTER TABLE "insights" ADD CONSTRAINT "insights_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_insights_v" ADD CONSTRAINT "_insights_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "insights_cover_image_idx" ON "insights" USING btree ("cover_image_id");
  CREATE INDEX "_insights_v_version_version_cover_image_idx" ON "_insights_v" USING btree ("version_cover_image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "insights" DROP CONSTRAINT "insights_cover_image_id_media_id_fk";
  
  ALTER TABLE "_insights_v" DROP CONSTRAINT "_insights_v_version_cover_image_id_media_id_fk";
  
  DROP INDEX "insights_cover_image_idx";
  DROP INDEX "_insights_v_version_version_cover_image_idx";
  ALTER TABLE "insights" DROP COLUMN "cover_type";
  ALTER TABLE "insights" DROP COLUMN "cover_image_id";
  ALTER TABLE "insights" DROP COLUMN "cover_caption";
  ALTER TABLE "_insights_v" DROP COLUMN "version_cover_type";
  ALTER TABLE "_insights_v" DROP COLUMN "version_cover_image_id";
  ALTER TABLE "_insights_v" DROP COLUMN "version_cover_caption";
  DROP TYPE "public"."enum_insights_cover_type";
  DROP TYPE "public"."enum__insights_v_version_cover_type";`)
}
