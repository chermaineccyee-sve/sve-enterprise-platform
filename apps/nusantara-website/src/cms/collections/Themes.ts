import { indicatorOptions, instrumentOptions } from "../taxonomy";
import { governed, keyField } from "./governed";

/** THEME — joins research to markets and indicators (content/model/intelligence.ts → Theme). */
export const Themes = governed({
  slug: "themes",
  singular: "Theme",
  plural: "Themes",
  group: "Research",
  useAsTitle: "title",
  separation: false,
  fields: [
    keyField("key", "Theme id", "Stable id."),
    { name: "title", type: "text", required: true },
    { name: "statement", type: "textarea", required: true },
    { name: "insights", type: "relationship", relationTo: "insights", hasMany: true, admin: { description: "Curated research, in display order." } },
    { name: "instruments", type: "select", hasMany: true, options: instrumentOptions },
    { name: "indicators", type: "select", hasMany: true, options: indicatorOptions },
  ],
});
