import { ACCESS_TO_ALLOCATION, APPROACH_COMPARISON } from "@/content/approach";

/**
 * "From Access to Governed Allocation": a typographic progression in which
 * each stage gains weight, followed by the earlier/disciplined comparison.
 */
export function AccessToAllocation() {
  return (
    <div>
      <ol className="grid border-y border-rule sm:grid-cols-3 lg:grid-cols-6">
        {ACCESS_TO_ALLOCATION.map((s, i) => {
          const strength = i / (ACCESS_TO_ALLOCATION.length - 1);
          return (
            <li
              key={s.term}
              className="relative border-b border-rule px-1 py-6 last:border-b-0 sm:border-r sm:px-5 sm:last:border-r-0 lg:border-b-0"
            >
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-teal-800" style={{ opacity: 0.12 + strength * 0.88 }} />
              <span className="num text-[11px] text-stone">0{i + 1}</span>
              <span
                className="mt-3 block font-serif text-[1.65rem] leading-none tracking-tight text-teal-900"
                style={{ opacity: 0.55 + strength * 0.45 }}
              >
                {s.term}
              </span>
              <span className="mt-3 block text-[13px] text-stone">{s.note}</span>
              {i < ACCESS_TO_ALLOCATION.length - 1 && (
                <span aria-hidden className="absolute right-3 top-6 hidden text-gold-600 lg:block">
                  →
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-14 grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p className="eyebrow text-stone">The shift</p>
          <p className="display-s mt-4 text-teal-900">The question is no longer whether an opportunity can be reached, but whether it is properly selected, governed, explained and monitored.</p>
        </div>
        <div className="lg:col-span-7 lg:col-start-6">
          <table className="w-full text-left">
            <caption className="sr-only">Earlier approach compared with a disciplined approach</caption>
            <thead>
              <tr>
                <th scope="col" className="eyebrow w-[44%] border-b border-rule pb-3 font-semibold text-stone">Earlier approach</th>
                <th scope="col" className="w-[12%] border-b border-rule pb-3"><span className="sr-only">becomes</span></th>
                <th scope="col" className="eyebrow border-b border-teal-800 pb-3 font-semibold text-teal-800">Disciplined approach</th>
              </tr>
            </thead>
            <tbody>
              {APPROACH_COMPARISON.map(([a, b]) => (
                <tr key={a} className="border-b border-rule-soft">
                  <td className="py-4 text-[15px] text-stone">{a}</td>
                  <td aria-hidden className="py-4 text-center text-gold-600">→</td>
                  <th scope="row" className="py-4 text-[1rem] font-medium text-teal-900">{b}</th>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
