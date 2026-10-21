"use client";

import { useEffect, useState } from "react";
import { LayerGlyph, LAYER_META } from "@/components/insights/ArticleBody";
import type { Layer } from "@/content/insights/types";

const LAYERS: Layer[] = ["data", "interpretation", "implication"];

/**
 * DATA → INTERPRETATION → IMPLICATION, made explorable: choose a layer to
 * follow it through the article — the other layers recede and the first
 * passage of that layer is brought into view. Choose it again to clear.
 */
export function LayerFocus({ targetId }: { targetId: string }) {
  const [focus, setFocus] = useState<Layer | null>(null);
  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    if (focus) el.dataset.focusLayer = focus;
    else delete el.dataset.focusLayer;
  }, [focus, targetId]);

  const choose = (l: Layer) => {
    const next = focus === l ? null : l;
    setFocus(next);
    if (!next) return;
    const first = document.querySelector<HTMLElement>(`#${targetId} [data-layer="${next}"]`);
    const r = first?.getBoundingClientRect();
    if (first && r && (r.top < 80 || r.top > window.innerHeight * 0.7)) {
      first.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    }
  };

  return (
    <div>
      <ul className="mt-4 space-y-1" role="group" aria-label="Follow a reading layer">
        {LAYERS.map((l) => {
          const on = focus === l;
          return (
            <li key={l}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => choose(l)}
                className={`flex w-full items-center gap-3 border-l-2 py-1.5 pl-3 text-left text-[13px] transition-colors ${on ? "border-gold-500 text-teal-900" : "border-transparent text-charcoal hover:border-rule hover:text-teal-800"}`}
              >
                <span className={l === "data" ? "text-teal-700" : l === "interpretation" ? "text-gold-700" : "text-teal-900"}>
                  <LayerGlyph layer={l} />
                </span>
                <strong className="font-semibold">{LAYER_META[l].label}</strong>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11.5px] leading-relaxed text-stone">{focus ? "Select again to read every layer." : "Select a layer to follow it through the article."}</p>
    </div>
  );
}
