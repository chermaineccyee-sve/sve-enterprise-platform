import { legalPageOptions } from "../taxonomy";
import { governed } from "./governed";

/**
 * LEGAL PAGE — versioned legal text (content/legal.ts → LegalPage). Every
 * version is kept and can be compared or restored. No final legal approver
 * is established yet (B0 decision): the legal-review fields record review
 * notes only and do not gate publication beyond the normal workflow.
 */
export const LegalPages = governed({
  slug: "legalPages",
  singular: "Legal page",
  plural: "Legal pages",
  group: "Corporate",
  useAsTitle: "title",
  separation: false,
  keepAllVersions: true,
  description: "Full version history is kept. A final legal approver has not yet been designated.",
  fields: [
    { name: "slug", type: "select", required: true, unique: true, options: legalPageOptions, admin: { description: "Fixed set of legal pages at /legal/[page]." } },
    { name: "title", type: "text", required: true },
    { name: "summary", type: "textarea", required: true },
    {
      name: "sections",
      type: "array",
      minRows: 1,
      fields: [
        { name: "heading", type: "text", required: true },
        { name: "body", type: "array", minRows: 1, labels: { singular: "Paragraph", plural: "Paragraphs" }, fields: [{ name: "text", type: "textarea", required: true }] },
      ],
    },
    {
      name: "versioning",
      label: "Version record",
      type: "group",
      fields: [
        { name: "versionLabel", label: "Version label", type: "text", admin: { description: "e.g. “v1.0”." } },
        { name: "effectiveDate", label: "Effective date", type: "date" },
        { name: "changeNote", label: "Change note", type: "textarea" },
        { name: "legalReviewNotes", label: "Legal review notes", type: "textarea", admin: { description: "Notes only. No final legal approver is designated yet." } },
      ],
    },
  ],
});
