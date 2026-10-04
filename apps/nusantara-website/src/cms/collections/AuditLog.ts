import type { CollectionConfig } from "payload";
import { approvers, nobody } from "../access/roles";

/** Append-only audit trail (see ../hooks/audit.ts). Readable by Reviewers and Admins; never editable. */
export const AuditLog: CollectionConfig = {
  slug: "auditLog",
  labels: { singular: "Audit entry", plural: "Audit log" },
  admin: { group: "Administration", useAsTitle: "summary", defaultColumns: ["at", "action", "collection", "title", "userEmail"] },
  access: { read: approvers, create: nobody, update: nobody, delete: nobody },
  timestamps: false,
  fields: [
    { name: "at", type: "date", required: true, index: true, admin: { date: { pickerAppearance: "dayAndTime" } } },
    {
      name: "action",
      type: "select",
      required: true,
      index: true,
      options: ["create", "edit", "submit", "approve", "publish", "archive", "classify", "restore", "delete", "user"],
    },
    { name: "collection", type: "text", required: true, index: true },
    { name: "documentId", type: "text", required: true, index: true },
    { name: "title", type: "text" },
    { name: "summary", type: "text", required: true },
    { name: "user", type: "relationship", relationTo: "users" },
    { name: "userEmail", type: "text" },
  ],
};
