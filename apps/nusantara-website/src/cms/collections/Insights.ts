import type { Block, Field } from "payload";
import { heroMotifOptions, insightCategoryOptions, instrumentOptions, layerOptions, marketStateDimensionOptions, researchAssetClassOptions } from "../taxonomy";
import { governed, keyField, lines } from "./governed";

/**
 * Article body blocks mirror the existing structured block union
 * (content/insights/types.ts → Block) one-to-one, so articles render through
 * the same templates. Every value is an ordinary form field — text, number
 * lists, repeatable rows, choices — so no one needs to edit JSON. Charts and
 * scenarios are article exhibits (not market data) and always carry their
 * source and illustrative status.
 */
const layerChoice = { name: "layer", label: "Research layer", type: "select" as const, options: layerOptions };
const path = (name: "downside" | "base" | "upside", label: string): Field => ({
  name,
  label,
  type: "group",
  fields: [
    { name: "label", label: "Path name", type: "text", admin: { description: "e.g. “Persistent”." } },
    { name: "assumption", type: "text", required: true },
    { name: "values", label: "Values per period", type: "number", hasMany: true, admin: { description: "One value per period, in order. Leave empty to use a constant annual rate instead." } },
    { name: "rate", label: "Constant annual rate (%)", type: "number", admin: { description: "Only when no values per period are given." } },
  ],
});

const blocks: Block[] = [
  {
    slug: "heading",
    labels: { singular: "Section heading", plural: "Section headings" },
    fields: [
      { name: "text", label: "Heading", type: "text", required: true },
      { name: "anchor", label: "Link anchor", type: "text", required: true, admin: { description: "Short lower-case name used in the article’s contents list, e.g. “framing”." } },
    ],
  },
  { slug: "paragraph", labels: { singular: "Paragraph", plural: "Paragraphs" }, fields: [{ name: "text", type: "textarea", required: true }] },
  { slug: "list", labels: { singular: "Bulleted list", plural: "Bulleted lists" }, fields: [lines("items", "Items", { required: true }), { name: "ordered", label: "Numbered list", type: "checkbox" }] },
  { slug: "pullquote", labels: { singular: "Pull quote", plural: "Pull quotes" }, fields: [{ name: "text", label: "Quote", type: "textarea", required: true }] },
  {
    slug: "layer",
    labels: { singular: "Research layer (Data · Interpretation · Implication)", plural: "Research layers" },
    fields: [{ ...layerChoice, required: true }, { name: "title", type: "text", required: true }, lines("body", "Paragraphs", { required: true, textarea: true })],
  },
  {
    slug: "table",
    labels: { singular: "Table", plural: "Tables" },
    fields: [
      { name: "caption", type: "text", required: true },
      { name: "columns", label: "Column headings", type: "text", hasMany: true, admin: { description: "Type each heading and press Enter." } },
      {
        name: "rows",
        type: "array",
        labels: { singular: "Row", plural: "Rows" },
        fields: [{ name: "cells", label: "Cells (in column order)", type: "text", hasMany: true }],
      },
      { name: "note", type: "textarea" },
      { ...layerChoice, admin: { description: "Optional: which research layer this table belongs to." } },
    ],
  },
  {
    slug: "comparison",
    labels: { singular: "Comparison", plural: "Comparisons" },
    fields: [
      { name: "caption", type: "text", required: true },
      { name: "left", label: "Left column heading", type: "text", required: true },
      { name: "right", label: "Right column heading", type: "text", required: true },
      {
        name: "rows",
        type: "array",
        labels: { singular: "Row", plural: "Rows" },
        fields: [
          { name: "leftText", label: "Left", type: "text", required: true },
          { name: "rightText", label: "Right", type: "text", required: true },
        ],
      },
    ],
  },
  {
    slug: "chart",
    labels: { singular: "Chart (article exhibit)", plural: "Charts" },
    fields: [
      { name: "caption", label: "Chart title", type: "text", required: true },
      { name: "kind", label: "Chart type", type: "select", required: true, options: [{ label: "Line", value: "line" }, { label: "Bar", value: "bar" }] },
      { name: "xLabels", label: "Labels along the bottom axis", type: "text", hasMany: true, admin: { description: "Type each label and press Enter, e.g. “Oct 25”." } },
      {
        name: "series",
        label: "Data series",
        type: "array",
        labels: { singular: "Series", plural: "Series" },
        fields: [
          { name: "seriesKey", label: "Series id", type: "text", required: true, admin: { description: "Short lower-case name, e.g. “gold”." } },
          { name: "label", label: "Name shown", type: "text", required: true },
          { name: "values", label: "Values (one per label, in order)", type: "number", hasMany: true },
        ],
      },
      { name: "unit", type: "text" },
      { name: "decimals", label: "Decimal places", type: "number", required: true, min: 0, max: 6, defaultValue: 1 },
      { name: "source", type: "text", required: true },
      { name: "illustrative", label: "Illustrative data", type: "checkbox", defaultValue: true },
    ],
  },
  {
    slug: "scenario",
    labels: { singular: "Scenario (three paths)", plural: "Scenarios" },
    fields: [
      {
        name: "scenario",
        label: "Scenario",
        type: "group",
        fields: [
          { name: "scenarioKey", label: "Scenario id", type: "text", required: true, admin: { description: "Short lower-case name, e.g. “inflation-paths”." } },
          { name: "title", type: "text", required: true },
          { name: "metric", label: "What is measured", type: "text", required: true },
          { name: "unit", type: "text" },
          { name: "decimals", label: "Decimal places", type: "number", required: true, min: 0, max: 6, defaultValue: 1 },
          { name: "baseYear", label: "Base year", type: "number", required: true },
          { name: "baseValue", label: "Starting value", type: "number", required: true },
          { name: "years", label: "Periods (years after base, starting 0)", type: "number", hasMany: true },
          { name: "periodLabels", label: "Period labels (optional)", type: "text", hasMany: true, admin: { description: "e.g. quarters, instead of years." } },
          path("downside", "Downside path"),
          path("base", "Base path"),
          path("upside", "Upside path"),
          { name: "period", label: "Period covered", type: "text", required: true },
          { name: "dataSource", label: "Data source", type: "text", required: true },
          { name: "methodology", type: "textarea", required: true },
        ],
      },
    ],
  },
  { slug: "callout", labels: { singular: "Callout box", plural: "Callout boxes" }, fields: [{ name: "title", type: "text", required: true }, { name: "text", type: "textarea", required: true }] },
];

/** INSIGHT — research articles (content/insights/types.ts → Insight). Categories are fixed. */
export const Insights = governed({
  slug: "insights",
  singular: "Insight",
  plural: "Insights",
  group: "Insights & Research",
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
            keyField("slug", "Web address (slug)", "URL segment under /insights/. Changing it changes the public URL."),
            { name: "title", type: "text", required: true },
            { name: "subtitle", type: "text", required: true },
            { name: "category", type: "select", required: true, options: insightCategoryOptions },
            { name: "date", label: "Edition date", type: "date", required: true },
            { name: "summary", type: "textarea", required: true },
            lines("executiveSummary", "Executive summary", { textarea: true }),
            lines("keyTakeaways", "Key takeaways (key observations)", { textarea: true }),
            { name: "body", label: "Article content", type: "blocks", blocks, labels: { singular: "Content section", plural: "Content sections" } },
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
            { name: "tags", type: "text", hasMany: true },
            { name: "related", type: "relationship", relationTo: "insights", hasMany: true },
            { name: "markets", type: "select", hasMany: true, options: instrumentOptions },
            { name: "themes", type: "relationship", relationTo: "themes", hasMany: true },
            { name: "assetClasses", label: "Asset classes", type: "select", hasMany: true, options: researchAssetClassOptions },
            { name: "capabilities", type: "relationship", relationTo: "capabilities", hasMany: true },
            { name: "marketStateDimensions", label: "Market State dimensions", type: "select", hasMany: true, options: marketStateDimensionOptions },
          ],
        },
        {
          label: "Cover visual",
          description: "The picture shown for this Insight on cards, the featured slot and the article header.",
          fields: [
            {
              name: "coverType",
              label: "Visual type",
              type: "select",
              required: true,
              defaultValue: "abstract",
              options: [
                { label: "Abstract — Nusantara pattern (default)", value: "abstract" },
                { label: "Image — from the Media library", value: "image" },
                { label: "Research visual — the article's first chart", value: "research" },
              ],
              admin: {
                description:
                  "Abstract: the generated Nusantara pattern. Image: an editorial image you are authorised to use. Research visual: the article's first chart on cards (the article itself shows its charts in the text). Featured slots show the first chart unless an image is chosen.",
              },
            },
            {
              name: "heroMotif",
              label: "Abstract pattern",
              type: "select",
              required: true,
              defaultValue: "arcs",
              options: heroMotifOptions,
              admin: { description: "Used when the visual type is Abstract, and whenever an image or chart is not available." },
            },
            {
              name: "coverImage",
              label: "Cover image",
              type: "upload",
              relationTo: "media",
              filterOptions: { mimeType: { contains: "image" } },
              admin: {
                condition: (data) => data?.coverType === "image",
                description:
                  "Upload or choose an image you are authorised to use (no third-party images without a licence). Alternative text, source/licence and the focal point are set on the image in Media. It appears on the website once a Reviewer or Admin has ticked “Approved for public use”; until then the abstract pattern is shown.",
              },
              validate: (value: unknown, { siblingData }: { siblingData: Record<string, unknown> }) =>
                siblingData?.coverType === "image" && !value ? "Choose an image, or set the visual type back to Abstract." : true,
            },
            {
              name: "coverCaption",
              label: "Caption",
              type: "text",
              admin: { condition: (data) => data?.coverType === "image", description: "Optional. Shown under the image with its source/credit." },
            },
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
