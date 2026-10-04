import type { Field } from "payload";
import { adminField } from "../access/roles";
import { publicationStatusOptions } from "../taxonomy";

/**
 * WORKFLOW and CLASSIFICATION — two independent dimensions (B0 decision).
 *
 *  workflowStatus   Draft → In review → Approved → Published → Archived
 *                   Where the item is in the editorial process. Values are the
 *                   existing PublicationStatus ids, so loaders map 1:1.
 *
 *  contentClass     Illustrative · Management review · Approved corporate content
 *                   What the content IS. Publishing never changes it, and it is
 *                   never inferred from workflow state. Only an Admin may
 *                   confirm Approved Corporate Content, and that confirmation
 *                   is recorded (who, when).
 *
 * Transitions are enforced server-side in ../hooks/workflow.ts. The fields
 * below that record who did what are read-only in the UI and written only by
 * that hook.
 */

export const WORKFLOW_STATUSES = ["draft", "review", "approved", "published", "archived"] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const CONTENT_CLASSES = ["illustrative", "management_review", "approved_corporate"] as const;
export type ContentClass = (typeof CONTENT_CLASSES)[number];

export const CONTENT_CLASS_LABEL: Record<ContentClass, string> = {
  illustrative: "Illustrative",
  management_review: "Management Review",
  approved_corporate: "Approved Corporate Content",
};

/** Names of every workflow/classification/audit field; everything else on a document is "content". */
export const WORKFLOW_FIELD_NAMES = [
  "workflowStatus",
  "contentClass",
  "classificationConfirmedBy",
  "classificationConfirmedAt",
  "submittedBy",
  "submittedAt",
  "lastEditedBy",
  "createdBy",
  "approvedByUser",
  "approvedBy",
  "approvedAt",
  "approvedContentHash",
  "publishedAt",
  "revisedAt",
  "legacy",
] as const;

const readOnlyUser = (name: string, label: string): Field => ({
  name,
  label,
  type: "relationship",
  relationTo: "users",
  admin: { readOnly: true, position: "sidebar" },
});

export function workflowFields(opts: { separation: boolean; timeSensitive?: boolean }): Field[] {
  return [
    {
      name: "workflowStatus",
      label: "Workflow",
      type: "select",
      required: true,
      defaultValue: "draft",
      index: true,
      options: [
        { label: "Draft", value: "draft" },
        { label: "In Review", value: "review" },
        { label: "Approved", value: "approved" },
        { label: "Published", value: "published" },
        { label: "Archived", value: "archived" },
      ],
      admin: {
        position: "sidebar",
        description: opts.separation
          ? "Editors: Draft or In review. A different Reviewer/Admin approves (no content changes in the same save), then publishes. You cannot approve or publish your own submission."
          : "Editors: Draft or In review. Reviewers/Admins may approve and publish.",
      },
    },
    {
      name: "contentClass",
      label: "Classification",
      type: "select",
      required: true,
      defaultValue: "illustrative",
      index: true,
      options: CONTENT_CLASSES.map((v) => ({ label: CONTENT_CLASS_LABEL[v], value: v })),
      admin: {
        position: "sidebar",
        description: "Independent of workflow. Publishing does not change it. Only an Admin may confirm Approved corporate content.",
      },
    },
    { name: "classificationConfirmedBy", label: "Classification confirmed by", type: "relationship", relationTo: "users", access: { update: adminField }, admin: { readOnly: true, position: "sidebar" } },
    { name: "classificationConfirmedAt", label: "Classification confirmed at", type: "date", admin: { readOnly: true, position: "sidebar", date: { pickerAppearance: "dayAndTime" } } },
    {
      name: "author",
      label: "Byline",
      type: "text",
      admin: { position: "sidebar", description: "Institutional byline, e.g. “Nusantara Investment Team”. Individual names only once approved." },
    },
    {
      name: "reviewAt",
      label: "Re-review by",
      type: "date",
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
        description: opts.timeSensitive
          ? "Required to publish: a future date. After it the item is withdrawn from the public site until re-reviewed."
          : "After this date the item is withdrawn from the public site until re-reviewed.",
      },
    },
    readOnlyUser("createdBy", "Created by"),
    readOnlyUser("lastEditedBy", "Last content edit by"),
    readOnlyUser("submittedBy", "Submitted for review by"),
    { name: "submittedAt", label: "Submitted at", type: "date", admin: { readOnly: true, position: "sidebar", date: { pickerAppearance: "dayAndTime" } } },
    readOnlyUser("approvedByUser", "Approved by (user)"),
    { name: "approvedBy", label: "Approver of record", type: "text", admin: { readOnly: true, position: "sidebar" } },
    { name: "approvedAt", label: "Approved at", type: "date", admin: { readOnly: true, position: "sidebar", date: { pickerAppearance: "dayAndTime" } } },
    { name: "approvedContentHash", type: "text", admin: { hidden: true } },
    { name: "publishedAt", label: "First published", type: "date", admin: { readOnly: true, position: "sidebar", date: { pickerAppearance: "dayAndTime" } } },
    {
      name: "revisedAt",
      label: "Last substantive update",
      type: "date",
      admin: { readOnly: true, position: "sidebar", date: { pickerAppearance: "dayAndTime" }, description: "Set automatically when content changes. Shown on the website as the update date." },
    },
    {
      name: "legacy",
      label: "Migrated record",
      type: "group",
      admin: {
        position: "sidebar",
        readOnly: true,
        description: "Preserved verbatim from the code-based content during migration. Never used to infer approval.",
        condition: (data) => Boolean(data?.legacy?.key),
      },
      fields: [
        { name: "key", label: "Legacy id", type: "text", index: true },
        { name: "status", label: "Legacy status", type: "select", options: publicationStatusOptions },
        { name: "sample", label: "Legacy sample flag", type: "checkbox" },
        { name: "updatedAt", label: "Legacy updatedAt", type: "text" },
        { name: "importHash", label: "Import fingerprint", type: "text", admin: { hidden: true } },
      ],
    },
  ];
}
