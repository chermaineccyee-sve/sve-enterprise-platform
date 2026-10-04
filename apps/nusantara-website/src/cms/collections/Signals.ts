import { instrumentOptions } from "../taxonomy";
import { governed, keyField } from "./governed";

/** SIGNAL — a short, dated note on what we are watching (content/model/intelligence.ts → Signal). */
export const Signals = governed({
  slug: "signals",
  singular: "Signal",
  plural: "Signals",
  group: "Nusantara interpretation",
  useAsTitle: "headline",
  separation: false,
  timeSensitive: true,
  fields: [
    keyField("key", "Signal id", "Stable id."),
    { name: "date", type: "date", required: true },
    { name: "theme", type: "text", required: true, admin: { description: "Short theme label shown with the signal." } },
    { name: "headline", type: "text", required: true },
    { name: "reading", type: "textarea", required: true },
    { name: "instrument", type: "select", options: instrumentOptions },
    { name: "insight", type: "relationship", relationTo: "insights" },
  ],
});
