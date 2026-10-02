"use client";

import { useState } from "react";
import { INTELLIGENCE_CATEGORIES, type IntelligenceCategory, type IntelligenceSnapshot } from "@/lib/market/types";
import { EconomicIndicator } from "./EconomicIndicator";

/** Level B — strategic market intelligence with category filtering. */
export function IntelligencePanel({ snapshot }: { snapshot: IntelligenceSnapshot }) {
  const [category, setCategory] = useState<IntelligenceCategory | "All">("All");
  const shown = category === "All" ? snapshot.indicators : snapshot.indicators.filter((i) => i.category === category);

  return (
    <div>
      <fieldset className="flex min-w-0 flex-wrap gap-1.5">
        <legend className="sr-only">Intelligence category</legend>
        {(["All", ...INTELLIGENCE_CATEGORIES] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
            className={`h-9 border px-3.5 text-[12.5px] transition-colors ${
              category === c ? "border-teal-800 bg-teal-800 text-white" : "border-rule bg-paper text-charcoal hover:border-teal-600"
            }`}
          >
            {c}
          </button>
        ))}
      </fieldset>
      <p className="sr-only" aria-live="polite">
        Showing {shown.length} indicators.
      </p>
      <ul className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((ind) => (
          <li key={ind.id}>
            <EconomicIndicator indicator={ind} />
          </li>
        ))}
      </ul>
    </div>
  );
}
