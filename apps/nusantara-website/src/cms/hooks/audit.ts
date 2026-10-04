import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, GlobalAfterChangeHook, PayloadRequest } from "payload";
import type { WorkflowEvent } from "./workflow";

/**
 * Append-only audit trail. Every create, edit, submission, approval,
 * publication, archive, classification change and deletion in a governed
 * collection writes one entry, in the same transaction as the change.
 * Entries cannot be edited or deleted through the Admin Portal or the API
 * (see ../collections/AuditLog.ts). Version history (Payload versions) holds
 * the full before/after content.
 */

type Action = "create" | "edit" | "submit" | "approve" | "publish" | "archive" | "classify" | "delete" | "user";

async function write(req: PayloadRequest, entry: { action: Action; collection: string; documentId: string; title?: string; summary: string }) {
  const u = req.user as { id: number; email?: string } | null;
  await req.payload.create({
    collection: "auditLog",
    data: { ...entry, user: u?.id ?? null, userEmail: u?.email ?? "system (server-side script)", at: new Date().toISOString() },
    req,
    overrideAccess: true,
  });
}

const titleOf = (doc: Record<string, unknown>) => String(doc.title ?? doc.name ?? doc.headline ?? doc.edition ?? doc.slug ?? doc.key ?? doc.email ?? doc.id ?? "");

export const auditAfterChange: CollectionAfterChangeHook = async ({ doc, operation, req, context, collection }) => {
  const ev = context.workflowEvent as WorkflowEvent | undefined;
  const base = { collection: collection.slug, documentId: String(doc.id), title: titleOf(doc) };
  if (operation === "create") await write(req, { ...base, action: "create", summary: `Created (${ev?.to ?? doc.workflowStatus ?? "draft"})` });
  else if (ev && ev.published && ev.to === "archived") await write(req, { ...base, action: "archive", summary: "Archived and withdrawn from the live site" });
  else if (ev && ev.published) await write(req, { ...base, action: "publish", summary: `Published${ev.contentChanged ? " with content changes" : ""}` });
  else if (ev && ev.to === "approved" && ev.from !== "approved") await write(req, { ...base, action: "approve", summary: "Approved" });
  else if (ev && ev.to === "review" && ev.from !== "review") await write(req, { ...base, action: "submit", summary: "Submitted for review" });
  else if (ev && ev.to === "archived" && ev.from !== "archived") await write(req, { ...base, action: "archive", summary: "Archived (working copy)" });
  else await write(req, { ...base, action: "edit", summary: ev ? `Saved (${ev.from} → ${ev.to})${ev.contentChanged ? ", content changed" : ""}` : "Saved" });
  if (ev?.classification) await write(req, { ...base, action: "classify", summary: `Classification ${ev.classification.from ?? "—"} → ${ev.classification.to}` });
  return doc;
};

export const auditAfterDelete: CollectionAfterDeleteHook = async ({ doc, req, collection }) => {
  await write(req, { action: "delete", collection: collection.slug, documentId: String(doc.id), title: titleOf(doc), summary: "Deleted" });
  return doc;
};

/** Users: account changes (never passwords or tokens). */
export const auditUserChange: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
  const summary =
    operation === "create" ? `Account created (role ${doc.role})` : previousDoc?.role !== doc.role ? `Role ${previousDoc?.role} → ${doc.role}` : "Account updated";
  await write(req, { action: "user", collection: "users", documentId: String(doc.id), title: doc.email, summary });
  return doc;
};

export const auditGlobalChange: GlobalAfterChangeHook = async ({ doc, req, global }) => {
  await write(req, { action: "edit", collection: `global:${global.slug}`, documentId: global.slug, title: global.slug, summary: doc._status === "published" ? "Published" : "Saved" });
  return doc;
};
