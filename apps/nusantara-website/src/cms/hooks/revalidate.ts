import { revalidateTag } from "next/cache";
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from "payload";
import type { WorkflowEvent } from "./workflow";

/**
 * On-demand revalidation. The public site's CMS loader caches each
 * collection under its own tag (src/lib/content/cms-source.ts). Only a change
 * to the LIVE version — publishing, withdrawing (archive) or deleting —
 * invalidates that tag; saving a draft, submitting, approving or restoring
 * never does, because none of them changes what the public sees.
 *
 * The next visit to any page that reads the collection re-renders that page
 * with the new content: no rebuild or redeploy.
 */
export const contentTag = (collection: string) => `cms:${collection}`;

function revalidate(collection: string) {
  try {
    revalidateTag(contentTag(collection), { expire: 0 });
  } catch {
    // Outside a Next.js request (CLI import, seed): nothing is cached yet.
  }
}

export const revalidateAfterChange: CollectionAfterChangeHook = ({ doc, collection, context, req }) => {
  const ev = context.workflowEvent as WorkflowEvent | undefined;
  // Signed-in changes: only when the live version changed. Server-side
  // scripts (no user) write live data directly, so they revalidate too.
  if (ev?.published || ev?.unpublished || (!req.user && doc?._status === "published")) revalidate(collection.slug);
  return doc;
};

export const revalidateAfterDelete: CollectionAfterDeleteHook = ({ doc, collection }) => {
  revalidate(collection.slug);
  return doc;
};
