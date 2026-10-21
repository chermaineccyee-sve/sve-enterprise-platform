import { sql } from "@payloadcms/db-postgres";
import type { CollectionSlug, Endpoint, PayloadRequest } from "payload";
import { roleOf } from "../access/roles";

/**
 * DISCARD DRAFT CHANGES — POST /api/cms/{collection}/{id}/discard-draft
 *
 * Abandons the unpublished working copy and returns it to the currently
 * published content. Only the draft versions saved AFTER the last published
 * version (by version id, i.e. save order) are removed; the published version becomes the working copy again.
 *
 * The live record is never read for writing, republished, restored or
 * modified, so the website does not change and nothing needs approval or
 * revalidation. Any signed-in Admin Portal user may discard (Editors
 * included); the next real edit goes through the normal workflow. Every
 * discard is recorded in the audit trail.
 */
type VersionDoc = { id: number; version: Record<string, unknown> };

const toSnake = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

export const discardDraftEndpoint = (collection: CollectionSlug): Endpoint => ({
  path: "/:id/discard-draft",
  method: "post",
  handler: async (req: PayloadRequest) => {
    if (!req.user || !roleOf(req)) return Response.json({ message: "Sign in to the Admin Portal." }, { status: 401 });
    const id = Number(req.routeParams?.id);
    if (!Number.isInteger(id) || id <= 0) return Response.json({ message: "Unknown item." }, { status: 400 });
    const { payload } = req;

    const lastPublished = (
      await payload.findVersions({
        collection,
        where: { and: [{ parent: { equals: id } }, { "version._status": { equals: "published" } }] },
        // Version ids increase with every save; createdAt is copied on restore, so it is not used for ordering.
        sort: "-id",
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
    ).docs[0] as unknown as VersionDoc | undefined;
    if (!lastPublished) {
      return Response.json({ message: "This item has never been published, so there is no published version to return to." }, { status: 409 });
    }

    const newer = await payload.findVersions({
      collection,
      where: { and: [{ parent: { equals: id } }, { id: { greater_than: lastPublished.id } }] },
      limit: 0,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    });
    if (newer.docs.length === 0) return Response.json({ message: "There are no unpublished changes to discard.", discarded: 0 });

    await payload.db.deleteVersions({
      collection,
      where: { and: [{ parent: { equals: id } }, { id: { greater_than: lastPublished.id } }] },
      req,
    });
    // The published version is the working copy again.
    const db = payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<unknown> }; tableNameMap: Map<string, string>; versionsSuffix?: string };
    const table = db.tableNameMap.get(`_${toSnake(collection)}${db.versionsSuffix ?? "_v"}`);
    if (!table) throw new Error(`Versions table for ${collection} not found.`);
    await db.drizzle.execute(sql`UPDATE ${sql.identifier(table)} SET latest = (id = ${lastPublished.id}) WHERE parent_id = ${id}`);

    const title = String(lastPublished.version.title ?? lastPublished.version.name ?? lastPublished.version.headline ?? lastPublished.version.edition ?? lastPublished.version.key ?? id);
    await payload.create({
      collection: "auditLog",
      data: {
        action: "discard",
        collection,
        documentId: String(id),
        title,
        summary: `Discarded ${newer.docs.length} unpublished draft version${newer.docs.length === 1 ? "" : "s"}; working copy returned to the published version (live version unchanged)`,
        user: (req.user as { id: number }).id,
        userEmail: (req.user as { email?: string }).email ?? "",
        at: new Date().toISOString(),
      },
      overrideAccess: true,
    });
    return Response.json({ message: "Draft changes discarded. The working copy is back to the published version.", discarded: newer.docs.length });
  },
});
