import type { Block, Layer } from "@/content/insights/types";
import { ArticleChart } from "./ArticleChart";
import { ScenarioAnalysis } from "./ScenarioAnalysis";

export const LAYER_META: Record<Layer, { label: string; description: string }> = {
  data: { label: "Data", description: "What the evidence shows" },
  interpretation: { label: "Interpretation", description: "What we believe it means" },
  implication: { label: "Implication", description: "What it means for allocation" },
};

const LAYER_STYLE: Record<Layer, string> = {
  data: "border border-teal-200 bg-teal-50 text-charcoal",
  interpretation: "border-l-2 border-gold-500 bg-ivory text-charcoal",
  implication: "bg-teal-900 text-teal-50",
};

export function LayerGlyph({ layer, className = "" }: { layer: Layer; className?: string }) {
  if (layer === "data")
    return (
      <svg aria-hidden viewBox="0 0 12 12" className={`h-3 w-3 ${className}`} fill="currentColor">
        <rect x="1" y="6" width="2" height="5" />
        <rect x="5" y="3" width="2" height="8" />
        <rect x="9" y="1" width="2" height="10" />
      </svg>
    );
  if (layer === "interpretation")
    return (
      <svg aria-hidden viewBox="0 0 12 12" className={`h-3 w-3 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.3">
        <circle cx="6" cy="6" r="4.5" />
        <circle cx="6" cy="6" r="1.5" fill="currentColor" />
      </svg>
    );
  return (
    <svg aria-hidden viewBox="0 0 12 12" className={`h-3 w-3 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M1 6h9M7 2.5L10.5 6 7 9.5" />
    </svg>
  );
}

function LayerTag({ layer, dark }: { layer: Layer; dark?: boolean }) {
  return (
    <p className={`eyebrow flex items-center gap-2 ${dark ? "text-gold-300" : layer === "data" ? "text-teal-700" : "text-gold-700"}`}>
      <LayerGlyph layer={layer} />
      {LAYER_META[layer].label}
    </p>
  );
}

/** Renders structured article blocks into the research template. */
export function ArticleBody({ blocks }: { blocks: Block[] }) {
  // Sequential figure and table numbers, computed up front.
  const numbering = blocks.reduce<{ fig: number; tab: number; at: number[] }>(
    (acc, b) => {
      if (b.type === "chart") acc.fig += 1;
      if (b.type === "table") acc.tab += 1;
      acc.at.push(b.type === "chart" ? acc.fig : b.type === "table" ? acc.tab : 0);
      return acc;
    },
    { fig: 0, tab: 0, at: [] },
  ).at;
  return (
    <div className="prose-nt">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading":
            return (
              <h2 key={i} id={b.id} className="display-s mt-16 text-teal-900 first:mt-0">
                {b.text}
              </h2>
            );
          case "paragraph":
            return (
              <p key={i} className="mt-5">
                {b.text}
              </p>
            );
          case "list": {
            const L = b.ordered ? "ol" : "ul";
            return (
              <L key={i} className={`mt-6 space-y-3 font-sans text-[16px] leading-relaxed ${b.ordered ? "list-none [counter-reset:item]" : ""}`}>
                {b.items.map((it, k) => (
                  <li key={k} className="relative border-t border-rule-soft pl-10 pt-3">
                    <span aria-hidden className="num absolute left-0 top-3 text-[13px] font-semibold text-gold-700">
                      {b.ordered ? String(k + 1).padStart(2, "0") : "—"}
                    </span>
                    {it}
                  </li>
                ))}
              </L>
            );
          }
          case "pullquote":
            return (
              <blockquote key={i} className="my-12 border-y border-gold-500/60 py-8 md:-mx-10 md:px-10">
                <p className="font-serif text-[1.65rem] italic leading-snug text-teal-900 md:text-[1.9rem]">“{b.text}”</p>
              </blockquote>
            );
          case "layer": {
            const dark = b.layer === "implication";
            return (
              <aside key={i} data-layer={b.layer} aria-label={`${LAYER_META[b.layer].label}: ${b.title}`} className={`my-8 p-6 font-sans md:p-7 ${LAYER_STYLE[b.layer]}`}>
                <LayerTag layer={b.layer} dark={dark} />
                <h3 className={`mt-3 font-serif text-[1.25rem] leading-snug ${dark ? "text-white" : "text-teal-900"}`}>{b.title}</h3>
                {b.body.map((t, k) => (
                  <p key={k} className={`mt-3 text-[15.5px] leading-relaxed ${dark ? "text-teal-100" : "text-charcoal"}`}>
                    {t}
                  </p>
                ))}
              </aside>
            );
          }
          case "table":
            return (
              <figure key={i} data-layer={b.layer} className="my-12 font-sans">
                <figcaption className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="eyebrow text-stone">Table {numbering[i]}</span>
                    <span className="mt-2 block font-serif text-[1.2rem] leading-snug text-teal-900">{b.caption}</span>
                  </span>
                  {b.layer && (
                    <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-stone">
                      <LayerGlyph layer={b.layer} /> {LAYER_META[b.layer].label}
                    </span>
                  )}
                </figcaption>
                {/* Desktop table */}
                <div className="scrollbar-thin mt-4 hidden overflow-x-auto md:block">
                  <table className="w-full border-t-2 border-teal-800 text-left text-[14px]">
                    <thead>
                      <tr className="border-b border-rule">
                        {b.columns.map((c) => (
                          <th key={c} scope="col" className="py-3 pr-6 text-[11px] font-medium uppercase tracking-[0.08em] text-stone">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {b.rows.map((r, k) => (
                        <tr key={k} className="border-b border-rule-soft align-top">
                          {r.map((cell, c) =>
                            c === 0 ? (
                              <th key={c} scope="row" className="py-3 pr-6 font-semibold text-teal-900">
                                {cell}
                              </th>
                            ) : (
                              <td key={c} className="py-3 pr-6 leading-relaxed text-charcoal">
                                {cell}
                              </td>
                            ),
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile: stacked definition cards */}
                <ul className="mt-4 space-y-3 md:hidden">
                  {b.rows.map((r, k) => (
                    <li key={k} className="border-l-2 border-teal-800 bg-paper px-4 py-3">
                      <p className="font-semibold text-teal-900">{r[0]}</p>
                      <dl className="mt-2 space-y-2 text-[14px]">
                        {r.slice(1).map((cell, c) => (
                          <div key={c}>
                            <dt className="text-[11px] uppercase tracking-[0.08em] text-stone">{b.columns[c + 1]}</dt>
                            <dd className="text-charcoal">{cell}</dd>
                          </div>
                        ))}
                      </dl>
                    </li>
                  ))}
                </ul>
                {b.note && <p className="mt-3 text-[12px] text-stone">{b.note}</p>}
              </figure>
            );
          case "comparison":
            return (
              <figure key={i} className="my-12 font-sans">
                <figcaption className="font-serif text-[1.2rem] leading-snug text-teal-900">{b.caption}</figcaption>
                <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-stretch text-[14px]">
                  <p className="eyebrow border-b border-rule pb-3 text-stone">{b.left}</p>
                  <span aria-hidden className="border-b border-rule" />
                  <p className="eyebrow border-b border-teal-800 pb-3 text-teal-800">{b.right}</p>
                  {b.rows.map(([l, r], k) => (
                    <div key={k} className="contents">
                      <p className="border-b border-rule-soft py-3 pr-3 text-stone">{l}</p>
                      <span aria-hidden className="flex items-center border-b border-rule-soft px-3 text-gold-600 md:px-6">
                        →
                      </span>
                      <p className="border-b border-rule-soft py-3 font-medium text-teal-900">{r}</p>
                    </div>
                  ))}
                </div>
              </figure>
            );
          case "chart":
            return <ArticleChart key={i} block={b} index={numbering[i]} />;
          case "scenario":
            return (
              <div key={i} id="scenario">
                <ScenarioAnalysis spec={b.scenario} />
              </div>
            );
          case "callout":
            return (
              <aside key={i} className="my-10 border border-rule bg-paper p-5 font-sans">
                <p className="eyebrow text-stone">{b.title}</p>
                <p className="mt-2 text-[14.5px] leading-relaxed text-charcoal">{b.text}</p>
              </aside>
            );
        }
      })}
    </div>
  );
}
