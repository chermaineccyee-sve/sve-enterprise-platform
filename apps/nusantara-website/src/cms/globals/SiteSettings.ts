import type { GlobalConfig } from "payload";
import { adminsOnly, signedIn } from "../access/roles";
import { auditGlobalChange } from "../hooks/audit";

const unconfirmed = "Leave empty until confirmed by management. Nothing here is shown publicly in B0.";

/**
 * SITE SETTINGS — corporate information. Every field starts EMPTY and is not
 * populated from the prototype: leadership, licences and regulatory status,
 * registered entity details and offices are unconfirmed (B0 decision).
 * Admin-only edits; full version history.
 */
export const SiteSettings: GlobalConfig = {
  slug: "siteSettings",
  label: "Corporate information",
  admin: { group: "Corporate", description: "Unconfirmed corporate facts stay empty. Do not enter placeholders." },
  access: { read: signedIn, readVersions: signedIn, update: adminsOnly },
  versions: { drafts: true, max: 100 },
  hooks: { afterChange: [auditGlobalChange] },
  fields: [
    {
      name: "entity",
      label: "Legal entity",
      type: "group",
      admin: { description: unconfirmed },
      fields: [
        { name: "legalName", label: "Registered legal name", type: "text" },
        { name: "registrationNumber", label: "Company registration number", type: "text" },
        { name: "registeredAddress", label: "Registered address", type: "textarea" },
      ],
    },
    {
      name: "licences",
      label: "Licences and regulatory status",
      type: "array",
      admin: { description: unconfirmed },
      fields: [
        { name: "regulator", type: "text", required: true },
        { name: "licence", label: "Licence / registration", type: "text", required: true },
        { name: "reference", type: "text" },
        { name: "jurisdiction", type: "text" },
      ],
    },
    {
      name: "offices",
      type: "array",
      admin: { description: unconfirmed },
      fields: [
        { name: "city", type: "text", required: true },
        { name: "address", type: "textarea" },
        { name: "phone", type: "text" },
      ],
    },
    {
      name: "leadership",
      type: "array",
      admin: { description: unconfirmed },
      fields: [
        { name: "name", type: "text", required: true },
        { name: "role", type: "text", required: true },
        { name: "biography", type: "textarea" },
      ],
    },
    {
      name: "contact",
      type: "group",
      admin: { description: unconfirmed },
      fields: [
        { name: "generalEmail", label: "General enquiries email", type: "email" },
        { name: "phone", type: "text" },
      ],
    },
  ],
};
