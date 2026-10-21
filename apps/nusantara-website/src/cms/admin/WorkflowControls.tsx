"use client";
/**
 * Nusantara workflow controls for governed collections, replacing Payload's
 * native status line and publish controls in the edit view. Payload's
 * draft/version engine is unchanged underneath; these controls only present
 * it in Nusantara's terms and route actions through the server-side rules.
 */
import { Button, ConfirmationModal, PublishButton, toast, UnpublishButton, useAuth, useDocumentInfo, useFormFields, useModal } from "@payloadcms/ui";
import { useState } from "react";

const WORKFLOW: Record<string, string> = { draft: "Draft", review: "In Review", approved: "Approved", published: "Published", archived: "Archived" };
const CLASS: Record<string, string> = { illustrative: "Illustrative", management_review: "Management Review", approved_corporate: "Approved Corporate Content" };
const isApprover = (role?: unknown) => role === "reviewer" || role === "admin";

/** Replaces Payload's "Status: Draft/Published/Changed — Revert to published". */
export function NusantaraStatus() {
  const { id, collectionSlug, hasPublishedDoc, unpublishedVersionCount } = useDocumentInfo();
  const workflow = useFormFields(([fields]) => fields.workflowStatus?.value as string | undefined);
  const contentClass = useFormFields(([fields]) => fields.contentClass?.value as string | undefined);
  const { openModal } = useModal();
  const [busy, setBusy] = useState(false);
  if (!id) return null;
  const hasDraftChanges = hasPublishedDoc && unpublishedVersionCount > 0;
  const modalSlug = `discard-draft-${id}`;

  const discard = async () => {
    setBusy(true);
    const res = await fetch(`/api/cms/${collectionSlug}/${id}/discard-draft`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } });
    const json = (await res.json().catch(() => ({}))) as { message?: string };
    if (res.ok) {
      toast.success(json.message ?? "Draft changes discarded.");
      window.location.reload();
    } else {
      toast.error(json.message ?? "Could not discard the draft changes.");
      setBusy(false);
    }
  };

  return (
    <div className="nusantara-status" aria-label="Workflow status">
      <span>
        Workflow: <strong>{WORKFLOW[workflow ?? ""] ?? "—"}</strong>
      </span>
      <span>
        Classification: <strong>{CLASS[contentClass ?? ""] ?? "—"}</strong>
      </span>
      <span>
        Website: <strong>{hasPublishedDoc ? "A published version is live" : "Not on the website"}</strong>
      </span>
      {hasDraftChanges && (
        <>
          <span className="nusantara-status__changes">Unpublished draft changes</span>
          <Button buttonStyle="secondary" size="small" disabled={busy} onClick={() => openModal(modalSlug)}>
            Discard draft changes
          </Button>
          <ConfirmationModal
            modalSlug={modalSlug}
            heading="Discard draft changes?"
            body="The unpublished changes will be removed and the working copy will return to the published version. The live website is not changed. Unsaved edits on this screen are also lost."
            confirmLabel="Discard draft changes"
            confirmingLabel="Discarding…"
            onConfirm={discard}
          />
        </>
      )}
    </div>
  );
}

/** Publishing is for Reviewers and Admins only (also enforced on the server). */
export function NusantaraPublishButton() {
  const { user } = useAuth();
  if (!isApprover((user as { role?: string } | null)?.role)) return null;
  return <PublishButton label="Publish to website" />;
}

/** Withdrawing a live item is for Reviewers and Admins only (also enforced on the server). */
export function NusantaraUnpublishButton() {
  const { user } = useAuth();
  if (!isApprover((user as { role?: string } | null)?.role)) return null;
  return <UnpublishButton label="Withdraw from website" />;
}
