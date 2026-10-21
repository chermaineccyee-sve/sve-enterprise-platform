import { RESILIENCE_CONCEPTS } from "@/content/approach";

/** RISK ↔ RESILIENCE ↔ RETURN — resilience as the overlap, with supporting disciplines. */
export function RiskFramework({ showConcepts = true, layout = "split" }: { showConcepts?: boolean; layout?: "split" | "stacked" }) {
  const split = layout === "split";
  return (
    <div className={split ? "grid gap-12 lg:grid-cols-12 lg:items-center" : "flex flex-col gap-8"}>
      <div className={split ? "lg:col-span-6" : "max-w-md"}>
        <svg viewBox="0 0 560 340" className="h-auto w-full" role="img" aria-label="Diagram: Risk and Return overlap; Resilience sits at their intersection.">
          <circle cx="200" cy="170" r="145" fill="none" stroke="#12384a" strokeWidth="1.4" />
          <circle cx="360" cy="170" r="145" fill="none" stroke="#12384a" strokeWidth="1.4" />
          <circle cx="280" cy="170" r="58" fill="#f4ecdb" stroke="#b8955a" strokeWidth="1.4" />
          <text x="135" y="176" textAnchor="middle" className="fill-teal-900 font-sans text-[22px] font-medium">Risk</text>
          <text x="425" y="176" textAnchor="middle" className="fill-teal-900 font-sans text-[22px] font-medium">Return</text>
          <text x="280" y="176" textAnchor="middle" className="fill-teal-900 text-[14px] font-semibold">Resilience</text>
          <text x="280" y="22" textAnchor="middle" className="fill-stone text-[11px] uppercase tracking-[0.08em]">↔</text>
        </svg>
      </div>
      <div className={split ? "lg:col-span-6" : ""}>
        <p className={split ? "display-s text-teal-900" : "font-serif text-[1.35rem] leading-snug text-teal-900"}>Confidence is created when opportunity is matched with risk communication, liquidity design, valuation discipline and governance oversight.</p>
        <p className="mt-5 text-[15px] leading-relaxed text-stone">
          Resilience does not remove risk. It describes whether risk, when it materialises, can be understood and managed — without forcing poor decisions.
        </p>
        {showConcepts && (
          <ul className="mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {RESILIENCE_CONCEPTS.map((c) => (
              <li key={c.title} className="border-t border-rule pt-3">
                <p className="text-[14.5px] font-semibold text-teal-900">{c.title}</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-stone">{c.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
