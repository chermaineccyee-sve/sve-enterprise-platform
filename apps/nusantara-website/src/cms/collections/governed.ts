import type { CollectionConfig, Field } from "payload";
import { adminsOnly, editors, signedIn } from "../access/roles";
import { workflowFields } from "../fields/workflow";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { workflowBeforeChange } from "../hooks/workflow";

/**
 * A governed editorial collection: version history with drafts (the live
 * version is the last *published* one), workflow + classification fields,
 * server-side transition rules and the audit trail.
 *
 * Access: signed-in staff only. Anonymous REST/API requests can read nothing
 * — the public site reads published content server-side through the content
 * repository (src/lib/content), never through this API.
 */
export function governed(opts: {
  slug: string;
  /** Shorter database table name, where Postgres's 63-character identifier limit requires it. */
  dbName?: string;
  singular: string;
  plural: string;
  group: string;
  useAsTitle: string;
  defaultColumns?: string[];
  /** Editor/Approver separation (Nusantara Views, Market State). */
  separation: boolean;
  description?: string;
  /** Keep every version (legal pages) instead of the most recent 100. */
  keepAllVersions?: boolean;
  fields: Field[];
}): CollectionConfig {
  return {
    slug: opts.slug,
    ...(opts.dbName ? { dbName: opts.dbName } : {}),
    labels: { singular: opts.singular, plural: opts.plural },
    admin: {
      group: opts.group,
      useAsTitle: opts.useAsTitle,
      defaultColumns: opts.defaultColumns ?? [opts.useAsTitle, "workflowStatus", "contentClass", "updatedAt"],
      description: opts.description,
    },
    access: {
      read: signedIn,
      readVersions: signedIn,
      create: editors,
      update: editors,
      delete: adminsOnly,
    },
    versions: { drafts: true, maxPerDoc: opts.keepAllVersions ? 0 : 100 },
    hooks: {
      beforeChange: [workflowBeforeChange({ separation: opts.separation })],
      afterChange: [auditAfterChange],
      afterDelete: [auditAfterDelete],
    },
    fields: [...opts.fields, ...workflowFields({ separation: opts.separation })],
  };
}

/** A unique, URL-safe identifier field. */
export const keyField = (name: string, label: string, description: string): Field => ({
  name,
  label,
  type: "text",
  required: true,
  unique: true,
  index: true,
  validate: (v: unknown) => (typeof v === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) ? true : "Lower-case letters, numbers and single hyphens only."),
  admin: { description },
});

/** A list of plain-text lines (bullets, paragraphs). Stored as rows of { text }. */
export const lines = (name: string, label: string, opts: { required?: boolean; textarea?: boolean } = {}): Field => ({
  name,
  label,
  type: "array",
  minRows: opts.required ? 1 : 0,
  labels: { singular: "Line", plural: "Lines" },
  fields: [opts.textarea ? { name: "text", type: "textarea", required: true } : { name: "text", type: "text", required: true }],
});

/** The five-step qualitative stance scale used by Views and the Market State. */
export const stanceField = (required: boolean): Field => ({
  name: "stance",
  type: "group",
  fields: [
    {
      name: "scale",
      label: "Scale (low → high, five labels)",
      type: "array",
      minRows: required ? 5 : 0,
      maxRows: 5,
      fields: [{ name: "label", type: "text", required: true }],
    },
    { name: "position", label: "Position (0 = low … 4 = high)", type: "number", min: 0, max: 4, required, admin: { step: 1 } },
  ],
});
