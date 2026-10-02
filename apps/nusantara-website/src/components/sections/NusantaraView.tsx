import { NUSANTARA_VIEW } from "@/content/view";
import { ReviewPlaceholder } from "@/components/ui/ReviewPlaceholder";

/** Editorial interpretation module. Themes frame thinking; they are not recommendations. */
export function NusantaraView() {
  const v = NUSANTARA_VIEW;
  return (
    <div className="grid gap-12 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <p className="eyebrow text-gold-700">Nusantara View</p>
        <p className="num mt-3 text-[13px] text-stone">{v.edition}</p>
        <h2 className="display-l mt-6 text-teal-900">{v.title}</h2>
        <p className="mt-6 text-[15.5px] leading-relaxed text-stone">{v.intro}</p>
        {v.status === "sample" && (
          <ReviewPlaceholder label="Sample commentary" className="mt-8">
            Prepared to demonstrate this module. Subject to investment-team review and approval before publication.
          </ReviewPlaceholder>
        )}
      </div>
      <dl className="grid border-t border-teal-800 sm:grid-cols-2 lg:col-span-8">
        {v.areas.map((a, i) => (
          <div key={a.area} className={`border-b border-rule py-7 sm:pr-8 ${i % 2 === 1 ? "sm:border-l sm:pl-8" : ""}`}>
            <dt className="flex items-baseline justify-between gap-4">
              <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-charcoal">{a.area}</span>
              <span className="font-serif text-[1.35rem] italic text-gold-700">{a.theme}</span>
            </dt>
            <dd className="mt-3 text-[15px] leading-relaxed text-charcoal">{a.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
