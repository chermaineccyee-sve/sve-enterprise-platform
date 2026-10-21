import { APIError, type CollectionBeforeChangeHook } from "payload";
import { adminField, adminsOnly, approverField } from "../access/roles";
import { capabilityStageOptions, capabilityStatusOptions, indicatorOptions, instrumentOptions } from "../taxonomy";
import { governed, keyField, lines } from "./governed";

const level = (name: string, label: string) => ({
  name,
  label,
  type: "select" as const,
  options: [
    { label: "Lower", value: "0" },
    { label: "Moderate", value: "1" },
    { label: "Higher", value: "2" },
  ],
});

/**
 * Products are never created through the CMS: an active product needs
 * approved product details, documents and an approved NAV/performance data
 * source, none of which is CMS content (content/strategies.ts → ProductDetails).
 */
const noProductsThroughCms: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  if (!req.user) return data;
  const status = data.capabilityStatus ?? originalDoc?.capabilityStatus;
  const stage = data.stage ?? originalDoc?.stage;
  const changedToProduct = (status === "active-product" && originalDoc?.capabilityStatus !== "active-product") || (stage === "active" && originalDoc?.stage !== "active");
  if (changedToProduct) {
    throw new APIError("An investment product cannot be created or activated through the Admin Portal. It requires approved product details, documents and an approved data source.", 403, null, true);
  }
  return data;
};

/**
 * CAPABILITY — investment capability areas (content/strategies.ts → Strategy).
 * Lifecycle status and stage are fixed taxonomies. Product details (offering
 * terms, NAV/performance, documents) are deliberately not editable here:
 * they require an approved product and an approved data source.
 */
export const Capabilities = governed({
  slug: "capabilities",
  singular: "Capability",
  plural: "Capabilities",
  group: "Corporate",
  useAsTitle: "name",
  defaultColumns: ["name", "capabilityStatus", "workflowStatus", "contentClass", "updatedAt"],
  separation: false,
  description: "Descriptive capability content and relationships. New capabilities: Admins only. Investment products cannot be created here.",
  create: adminsOnly,
  beforeChange: [noProductsThroughCms],
  fields: [
    keyField("slug", "Web address (slug)", "URL segment under /strategies/. Set by an Admin; changing it changes the public URL.", { update: adminField }),
    { name: "name", type: "text", required: true },
    {
      name: "capabilityStatus",
      label: "Capability lifecycle",
      type: "select",
      required: true,
      defaultValue: "internal",
      options: capabilityStatusOptions,
      access: { update: approverField },
      admin: { description: "Governance lifecycle (Reviewers/Admins). “active-product” cannot be set here." },
    },
    { name: "stage", type: "select", required: true, options: capabilityStageOptions, access: { update: approverField }, admin: { description: "Public stage (Reviewers/Admins). “Active” cannot be set here." } },
    { name: "summary", type: "textarea", required: true },
    { name: "overview", type: "textarea", required: true },
    { name: "approach", type: "textarea", required: true },
    lines("opportunitySet", "Opportunity set"),
    lines("riskConsiderations", "Risk considerations"),
    { name: "timeHorizon", label: "Time horizon", type: "text", admin: { description: "Leave empty until supplied." } },
    lines("characteristics", "Characteristics"),
    { name: "role", label: "Role in a portfolio", type: "text", required: true },
    {
      name: "profile",
      label: "Indicative asset-class profile (not product terms)",
      type: "group",
      fields: [level("liquidity", "Liquidity"), level("income", "Income"), level("complexity", "Complexity"), level("valuationFrequency", "Valuation frequency")],
    },
    { name: "markets", type: "select", hasMany: true, options: instrumentOptions },
    { name: "indicators", type: "select", hasMany: true, options: indicatorOptions },
    { name: "insights", type: "relationship", relationTo: "insights", hasMany: true },
  ],
});
