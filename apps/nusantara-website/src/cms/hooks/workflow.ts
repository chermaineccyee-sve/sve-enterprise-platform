import { createHash } from "node:crypto";
import { APIError, type CollectionBeforeChangeHook, type CollectionBeforeOperationHook, type PayloadRequest } from "payload";
import { canApprove, hasRole, roleOf } from "../access/roles";
import { WORKFLOW_FIELD_NAMES, type ContentClass, type WorkflowStatus } from "../fields/workflow";

/**
 * Server-side workflow enforcement for every governed collection. Runs inside
 * Payload's update/create operation, so it applies equally to the Admin UI,
 * the REST API and the Local API. The UI only offers choices; this decides.
 *
 * Rules
 *  - Editors may set Draft or In review only, and can never publish.
 *  - Approving and publishing require Reviewer or Admin.
 *  - Separated collections (Nusantara Views, Market State):
 *      · approval only from In review;
 *      · the approver/publisher must not be the creator, the submitter or the
 *        last content editor of the item;
 *      · an approval save must not change content;
 *      · publishing requires the exact content that was approved (hash check).
 *  - Ordinary copy (proportionate): a Reviewer/Admin may approve and publish
 *    in one step; the publisher is recorded as approver.
 *  - Any content change to approved or published material returns the working
 *    copy to Draft (the live version stays live until a new publish).
 *  - Classification is separate: publishing never changes it; only an Admin
 *    may set Approved corporate content, and the confirmation is recorded.
 *  - Who-did-what fields can only be written by this hook.
 *
 * Calls with no user are server-side Local API calls (seed/migration
 * scripts); the REST API never reaches this hook without a signed-in user
 * because collection access denies anonymous writes first.
 */

type Doc = Record<string, unknown> & {
  workflowStatus?: WorkflowStatus;
  contentClass?: ContentClass;
  approvedContentHash?: string | null;
  createdBy?: unknown;
  submittedBy?: unknown;
  lastEditedBy?: unknown;
  approvedByUser?: unknown;
  approvedBy?: string | null;
  publishedAt?: string | null;
  _status?: "draft" | "published";
};

const SYSTEM_KEYS = new Set(["id", "createdAt", "updatedAt", "_status", ...WORKFLOW_FIELD_NAMES]);
const RECORDED = WORKFLOW_FIELD_NAMES.filter((f) => f !== "workflowStatus" && f !== "contentClass");

const forbid = (message: string) => new APIError(message, 403, null, true);
const idOf = (v: unknown): string | null => (v && typeof v === "object" && "id" in v ? String((v as { id: unknown }).id) : v == null || v === "" ? null : String(v));

/** Stable, representation-independent form of a value for comparison. */
function normalise(v: unknown): unknown {
  if (v === undefined || v === null || v === "") return null;
  if (Array.isArray(v)) return v.map(normalise);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    // A populated relationship compares by id.
    if ("id" in o && ("createdAt" in o || "updatedAt" in o)) return String(o.id);
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) {
      const n = normalise(o[k]);
      if (n !== null) out[k] = n;
    }
    return out;
  }
  return v;
}

/** Hash of the document's content fields — everything except workflow, classification and system fields. */
export function contentHash(doc: Record<string, unknown> | undefined): string {
  const content: Record<string, unknown> = {};
  for (const k of Object.keys(doc ?? {}).sort()) if (!SYSTEM_KEYS.has(k)) content[k] = (doc as Record<string, unknown>)[k];
  return createHash("sha256").update(JSON.stringify(normalise(content))).digest("hex");
}

export type WorkflowEvent = {
  from: WorkflowStatus;
  to: WorkflowStatus;
  published: boolean;
  contentChanged: boolean;
  restored?: boolean;
  unpublished?: boolean;
  classification?: { from: ContentClass | null; to: ContentClass };
};

const displayName = (req: PayloadRequest) => {
  const u = req.user as { name?: string | null; email?: string } | null;
  return (u?.name && u.name.trim()) || u?.email || "Unknown user";
};

export function workflowBeforeChange(opts: { separation: boolean; timeSensitive?: boolean }): CollectionBeforeChangeHook {
  return ({ data, originalDoc, operation, req, context }) => {
    const d = data as Doc;
    const orig = (originalDoc ?? {}) as Doc;

    // System (Local API, no user): migration/seed. Accepted as given.
    if (!req.user) return d;
    const role = roleOf(req);
    if (!role) throw forbid("Your account has no Admin Portal role.");
    const me = String(req.user.id);
    const now = new Date().toISOString();

    // Who-did-what fields are never taken from the client.
    for (const f of RECORDED) {
      const v = operation === "create" ? undefined : orig[f];
      // Groups (legacy) must be an object or absent, never null.
      if (v == null && f === "legacy") delete d[f];
      else (d as Record<string, unknown>)[f] = v ?? null;
    }

    const prev: WorkflowStatus = operation === "create" ? "draft" : (orig.workflowStatus ?? "draft");
    // Restoring an earlier version always produces a new Draft working copy
    // (restores run as drafts — see restoreAsDraft below); it never publishes.
    const restoring = context.restoring === true;
    const unpublishing = context.unpublishing === true;
    if (restoring || unpublishing) d.workflowStatus = "draft";
    let next: WorkflowStatus = d.workflowStatus ?? prev;
    const publishing = !restoring && d._status === "published";
    const merged: Doc = { ...orig, ...d };
    const hash = contentHash(merged);
    const contentChanged = operation === "create" || restoring || hash !== contentHash(orig);
    const actors = [orig.createdBy, orig.submittedBy, orig.lastEditedBy].map(idOf);
    const ownWork = operation === "create" || contentChanged || actors.includes(me);

    /* Editors -------------------------------------------------------- */
    if (role === "editor") {
      if (publishing) throw forbid("Editors cannot publish. Submit the item for review instead.");
      if (next !== prev && !["draft", "review"].includes(next)) throw forbid("Editors may set Draft or In review only.");
      if (next === prev && ["approved", "published", "archived"].includes(next) && contentChanged) next = "draft";
    }

    /* Content changes void earlier approval -------------------------- */
    if (contentChanged && operation === "update") {
      if (next === "approved" && prev !== "approved" && opts.separation) throw forbid("Approval cannot include content changes. Save the edits first; a different reviewer then approves.");
      if (prev === "approved" && next === "approved") next = "draft";
      if (prev === "published" && next === "published" && !publishing) next = "draft";
    }

    /* Selecting Published without the Publish action ------------------ */
    if (next === "published" && !publishing && prev !== "published") throw forbid("Use Publish to publish an approved item.");
    if (next === "archived" && prev !== "archived" && !canApprove(req)) throw forbid("Only a Reviewer or Admin may archive.");

    /* Submit --------------------------------------------------------- */
    // A content change saved as In review is a (re)submission by whoever made it.
    if (next === "review" && (prev !== "review" || contentChanged)) {
      d.submittedBy = req.user.id;
      d.submittedAt = now;
    }

    /* Approve -------------------------------------------------------- */
    const recordApproval = () => {
      d.approvedByUser = req.user!.id;
      d.approvedBy = displayName(req);
      d.approvedAt = now;
      d.approvedContentHash = hash;
    };
    if (next === "approved" && prev !== "approved") {
      if (!canApprove(req)) throw forbid("Only a Reviewer or Admin may approve.");
      if (opts.separation) {
        if (prev !== "review") throw forbid("Only an item In review can be approved.");
        if (ownWork) throw forbid("You created, edited or submitted this item, so you cannot approve it. A different Reviewer or Admin must approve.");
      }
      recordApproval();
    }

    /* Publish -------------------------------------------------------- */
    if (publishing) {
      if (!canApprove(req)) throw forbid("Only a Reviewer or Admin may publish.");
      if (next === "archived") {
        // Withdrawing: the live record becomes Archived and leaves the public site.
      } else if (opts.separation) {
        if (prev !== "approved" && prev !== "published") throw forbid("Only an approved item can be published.");
        if (orig.approvedContentHash !== hash) throw forbid("The content differs from what was approved. It must be submitted and approved again.");
        if (ownWork) throw forbid("You created, edited or submitted this item, so you cannot publish it.");
        next = "published";
      } else {
        if (prev !== "approved" && prev !== "published") recordApproval();
        else if (contentChanged) recordApproval();
        next = "published";
      }
      if (next === "published" && opts.timeSensitive) {
        const reviewAt = merged.reviewAt ? Date.parse(String(merged.reviewAt)) : NaN;
        if (!(reviewAt > Date.now())) throw forbid("Set a future “Re-review by” date before publishing time-sensitive interpretation (it must be part of the approved content).");
      }
      if (next === "published" && !d.publishedAt) d.publishedAt = now;
    }

    /* Classification (independent of workflow) ------------------------ */
    const fromClass = operation === "create" ? null : (orig.contentClass ?? null);
    const toClass = (d.contentClass ?? fromClass ?? "illustrative") as ContentClass;
    if (toClass !== fromClass) {
      if (toClass === "approved_corporate") {
        if (!hasRole(req, "admin")) throw forbid("Only an Admin may classify content as Approved corporate content.");
        d.classificationConfirmedBy = req.user.id;
        d.classificationConfirmedAt = now;
      } else if (fromClass === "approved_corporate") {
        if (!canApprove(req)) throw forbid("Only a Reviewer or Admin may change Approved corporate content.");
        d.classificationConfirmedBy = null;
        d.classificationConfirmedAt = null;
      }
    }

    /* Authorship ----------------------------------------------------- */
    if (operation === "create") d.createdBy = req.user.id;
    if (contentChanged) {
      d.lastEditedBy = req.user.id;
      d.revisedAt = now;
    }
    if (next === "draft" && contentChanged && operation === "update") {
      // A new working copy needs a new approval.
      d.approvedContentHash = null;
    }

    d.workflowStatus = next;
    const event: WorkflowEvent = { from: prev, to: next, published: publishing, unpublished: unpublishing, contentChanged, restored: restoring, ...(toClass !== fromClass && operation === "update" ? { classification: { from: fromClass, to: toClass } } : {}) };
    context.workflowEvent = event;
    return d;
  };
}

/**
 * Restores always create a Draft working copy, for every governed collection:
 * the restored content then goes through review (and, for Nusantara Views and
 * the Market State, separate approval) before it can be published. A
 * non-draft restore would overwrite — or unpublish — the live version, so it
 * is refused. The Admin Portal's API route (app/(payload)/api/cms) requests
 * every restore as a draft, so the restore buttons work as expected.
 */
export const restoreAsDraft: CollectionBeforeOperationHook = ({ operation, args, req }) => {
  if (operation !== "restoreVersion") return args;
  if (req.user && (args as { draft?: boolean }).draft !== true) throw forbid("Versions are restored as a Draft working copy, which then goes through review.");
  req.context.restoring = true;
  return args;
};

/**
 * The live version can only change through an explicit Publish (validated by
 * the workflow rules) or an Unpublish by a Reviewer/Admin. Any other signed-in
 * save — e.g. an API request without the draft flag — is turned into a draft
 * save, so it can never overwrite live content.
 */
export const guardLiveWrites: CollectionBeforeOperationHook = ({ operation, args, req }) => {
  if (operation !== "update" || !req.user) return args;
  const a = args as { draft?: boolean; data?: { _status?: string } };
  if (a.data?._status === "published") return args;
  if (a.draft) return args;
  if (a.data?._status === "draft") {
    if (!canApprove(req)) throw forbid("Only a Reviewer or Admin may unpublish (withdraw) live content.");
    req.context.unpublishing = true;
    return args;
  }
  return { ...args, draft: true };
};
