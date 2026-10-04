import type { Block, Field } from "payload";
import { heroMotifOptions, indicatorOptions, insightCategoryOptions, instrumentOptions, layerOptions, marketStateDimensionOptions, researchAssetClassOptions } from "../taxonomy";
import { governed, keyField, lines } from "./governed";

/**
 * Article body blocks mirror the existing structured block union
 * (content/insights/types.ts → Block) one-to-one, so migrated articles render
 * through the same templates. Charts and scenarios keep their numeric series
 * as structured JSON: they are article exhibits rather than market data, and
 * are always labelled with their source and illustrative status.
 */
const strings = (name: string, label: string): Field => ({ name, label, type: "json", admin: { description: "JSON array of strings." } });

const blocks: Block[] = [
  { slug: "heading", fields: [{ name: "text", type: "text", required: true }, { name: "anchor", type: "text", required: true, admin: { description: "In-page anchor id." } }] },
  { slug: "paragraph", fields: [{ name: "text", type: "textarea", required: true }] },
  { slug: "list", fields: [lines("items", "Items", { required: true }), { name: "ordered", type: "checkbox" }] },
  { slug: "pullquote", fields: [{ name: "text", type: "textarea", required: true }] },
  { slug: "layer", fields: [{ name: "layer", type: "select", options: layerOptions, required: true }, { name: "title", type: "text", required: true }, lines("body", "Paragraphs", { required: true, textarea: true })] },
  {
    slug: "table",
    fields: [
      { name: "caption", type: "text", required: true },
      strings("columns", "Columns"),
      { name: "rows", type: "json", admin: { description: "JSON array of rows (arrays of strings)." } },
      { name: "note", type: "textarea" },
      { name: "layer", type: "select", options: layerOptions },
    ],
  },
  {
    slug: "comparison",
    fields: [
      { name: "caption", type: "text", required: true },
      { name: "left", type: "text", required: true },
      { name: "right", type: "text", required: true },
      { name: "rows", type: "json", admin: { description: "JSON array of [left, right] pairs." } },
    ],
  },
  {
    slug: "chart",
    fields: [
      { name: "caption", type: "text", required: true },
      { name: "kind", type: "select", required: true, options: ["line", "bar"] },
      strings("xLabels", "X-axis labels"),
      { name: "series", type: "json", admin: { description: "JSON array of { id, label, values[] }." } },
      { name: "unit", type: "text" },
      { name: "decimals", type: "number", required: true, min: 0, max: 6 },
      { name: "source", type: "text", required: true },
      { name: "illustrative", type: "checkbox", defaultValue: true },
    ],
  },
  { slug: "scenario", fields: [{ name: "scenario", type: "json", required: true, admin: { description: "Scenario specification (content/insights/types.ts → ScenarioSpec)." } }] },
  { slug: "callout", fields: [{ name: "title", type: "text", required: true }, { name: "text", type: "textarea", required: true }] },
];

/** INSIGHT — research articles (content/insights/types.ts → Insight). Categories are fixed. */
export const Insights = governed({
  slug: "insights",
  singular: "Insight",
  plural: "Insights",
  group: "Research",
  useAsTitle: "title",
  defaultColumns: ["title", "category", "workflowStatus", "contentClass", "updatedAt"],
  separation: false,
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "Article",
          fields: [
            keyField("slug", "Slug", "URL segment under /insights/. Changing it changes the public URL."),
            { name: "title", type: "text", required: true },
            { name: "subtitle", type: "text", required: true },
            { name: "category", type: "select", required: true, options: insightCategoryOptions },
            { name: "date", label: "Edition date", type: "date", required: true },
            { name: "summary", type: "textarea", required: true },
            lines("executiveSummary", "Executive summary", { textarea: true }),
            lines("keyTakeaways", "Key takeaways", { textarea: true }),
            { name: "body", type: "blocks", blocks },
            { name: "methodology", type: "textarea" },
          ],
        },
        {
          label: "Sources",
          fields: [
            {
              name: "sources",
              type: "array",
              fields: [
                { name: "label", type: "text", required: true },
                { name: "detail", type: "text" },
                { name: "url", type: "text", admin: { description: "Only where the licence permits." } },
                { name: "provider", type: "text" },
                { name: "publishedAt", type: "date" },
                { name: "retrievedAt", type: "date" },
                { name: "licensingNote", type: "textarea" },
                { name: "methodology", type: "textarea" },
              ],
            },
          ],
        },
        {
          label: "Relationships",
          fields: [
            { name: "featured", type: "checkbox" },
            { name: "heroMotif", label: "Hero motif", type: "select", required: true, defaultValue: "arcs", options: heroMotifOptions },
            { name: "tags", type: "text", hasMany: true },
            { name: "related", type: "relationship", relationTo: "insights", hasMany: true },
            { name: "markets", type: "select", hasMany: true, options: instrumentOptions },
            { name: "themes", type: "relationship", relationTo: "themes", hasMany: true },
            { name: "assetClasses", label: "Asset classes", type: "select", hasMany: true, options: researchAssetClassOptions },
            { name: "capabilities", type: "relationship", relationTo: "capabilities", hasMany: true },
            { name: "marketStateDimensions", label: "Market State dimensions", type: "select", hasMany: true, options: marketStateDimensionOptions },
            { name: "indicators", type: "select", hasMany: true, options: indicatorOptions, admin: { description: "Optional structural indicators discussed." } },
          ],
        },
        {
          label: "SEO",
          fields: [
            {
              name: "seo",
              type: "group",
              fields: [
                { name: "title", type: "text" },
                { name: "description", type: "textarea" },
                { name: "image", type: "upload", relationTo: "media" },
              ],
            },
          ],
        },
      ],
    },
  ],
});
