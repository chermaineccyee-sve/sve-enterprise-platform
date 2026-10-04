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
  fields: [
    keyField("slug", "Slug", "URL segment under /strategies/. Changing it changes the public URL."),
    { name: "name", type: "text", required: true },
    { name: "capabilityStatus", label: "Capability lifecycle", type: "select", required: true, defaultValue: "internal", options: capabilityStatusOptions },
    { name: "stage", type: "select", required: true, options: capabilityStageOptions },
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
