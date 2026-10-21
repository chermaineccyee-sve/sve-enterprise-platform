import { indicatorOptions, instrumentOptions, marketAssetClassOptions, marketStateDimensionOptions } from "../taxonomy";
import { governed, keyField, lines, stanceField } from "./governed";

/** NUSANTARA VIEW — Nusantara's reading of a market, asset class or indicator (content/model/intelligence.ts → NusantaraView). */
export const NusantaraViews = governed({
  slug: "nusantaraViews",
  singular: "Nusantara View",
  plural: "Nusantara Views",
  group: "Nusantara Intelligence",
  useAsTitle: "key",
  defaultColumns: ["key", "signal", "workflowStatus", "contentClass", "updatedAt"],
  separation: true,
  timeSensitive: true,
  description: "House interpretation. Editor/Approver separation applies: you cannot approve or publish your own submission.",
  fields: [
    keyField("key", "Identifier", "Stable id, e.g. “klci”. Matches the existing code-based view id."),
    {
      name: "subject",
      type: "group",
      fields: [
        {
          name: "kind",
          type: "select",
          required: true,
          options: [
            { label: "Instrument", value: "instrument" },
            { label: "Asset class", value: "assetClass" },
            { label: "Structural indicator", value: "indicator" },
          ],
        },
        { name: "instrument", type: "select", options: instrumentOptions, admin: { condition: (_, s) => s?.kind === "instrument" } },
        { name: "assetClass", type: "select", options: marketAssetClassOptions, admin: { condition: (_, s) => s?.kind === "assetClass" } },
        { name: "indicator", type: "select", options: indicatorOptions, admin: { condition: (_, s) => s?.kind === "indicator" } },
      ],
    },
    { name: "signal", type: "text", admin: { description: "One word or short phrase, e.g. “Selective”. Empty for indicator readings." } },
    stanceField(false),
    { name: "summary", type: "textarea", admin: { description: "One line used in cross-asset comparisons." } },
    { name: "context", type: "textarea", required: true },
    lines("whatWeAreWatching", "What we’re watching"),
    { name: "keyRisk", label: "Key risk", type: "textarea" },
    { name: "whatWouldChangeOurView", label: "What would change our view", type: "textarea" },
    { name: "relatedMarkets", label: "Related markets", type: "select", hasMany: true, options: instrumentOptions },
    { name: "relatedInsight", label: "Related insight", type: "relationship", relationTo: "insights" },
    { name: "theme", label: "Theme label", type: "text", admin: { description: "Short label shown with the view, e.g. “Resilience”." } },
    { name: "marketStateDimensions", label: "Market State dimensions", type: "select", hasMany: true, options: marketStateDimensionOptions, admin: { description: "Dimensions this view reads into, most relevant first." } },
    {
      name: "capabilities",
      label: "Related capabilities",
      type: "relationship",
      relationTo: "capabilities",
      hasMany: true,
      admin: { description: "Capabilities this market relates to (in addition to capabilities that list the market). Instrument views only." },
    },
  ],
});
