import { instrumentOptions, marketStateDimensionOptions, publicationStatusOptions } from "../taxonomy";
import { governed, keyField, lines, stanceField } from "./governed";

/** NUSANTARA MARKET STATE — published as a whole edition (content/model/intelligence.ts → MarketStateEdition). */
export const MarketStateEditions = governed({
  slug: "marketStateEditions",
  dbName: "market_state",
  singular: "Market State edition",
  plural: "Market State editions",
  group: "Nusantara interpretation",
  useAsTitle: "edition",
  separation: true,
  timeSensitive: true,
  description: "House interpretation, published as a whole edition. Editor/Approver separation applies.",
  fields: [
    keyField("key", "Edition id", "e.g. “market-state-2026-10”."),
    { name: "edition", type: "text", required: true, admin: { description: "Edition name, e.g. “October 2026”." } },
    {
      name: "framing",
      type: "group",
      admin: { description: "Framing shown for sample/demonstration editions. Leave empty for a published house view." },
      fields: [
        { name: "title", type: "text" },
        { name: "note", type: "textarea" },
      ],
    },
    {
      name: "dimensions",
      type: "array",
      maxRows: 6,
      labels: { singular: "Dimension", plural: "Dimensions" },
      fields: [
        { name: "dimension", type: "select", required: true, options: marketStateDimensionOptions },
        { name: "label", type: "text", required: true },
        { name: "state", type: "text", required: true },
        stanceField(true),
        { name: "summary", type: "textarea", required: true },
        lines("watchItems", "Watch items"),
        { name: "changeConditions", label: "What would change this", type: "textarea", required: true },
        { name: "supportingMarkets", dbName: "ms_dim_markets", enumName: "enum_ms_dim_markets", type: "select", hasMany: true, options: instrumentOptions },
        { name: "relatedInsight", type: "relationship", relationTo: "insights" },
        { name: "capabilities", label: "Related capabilities", type: "relationship", relationTo: "capabilities", hasMany: true },
        { name: "dimensionUpdatedAt", label: "Dimension updated", type: "date" },
        {
          name: "dimensionStatus",
          label: "Dimension status",
          type: "select",
          required: true,
          defaultValue: "draft",
          options: publicationStatusOptions,
          admin: { description: "Per-dimension status, preserved from the existing model." },
        },
      ],
    },
  ],
});
