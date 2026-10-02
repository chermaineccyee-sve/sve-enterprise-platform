import { GOVERNANCE_LAYERS } from "@/content/governance";

/**
 * Layered governance stack. Each layer narrows the set of decisions that can
 * pass through unexamined; widths step to suggest a structure, not a hierarchy of people.
 */
export function GovernanceStack({ compact = false, tone = "light" }: { compact?: boolean; tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  const layers = GOVERNANCE_LAYERS;
  return (
    <ol className="space-y-2">
      {layers.map((l, i) => {
        const inset = compact ? 0 : Math.abs(i - (layers.length - 1) / 2) * 2.2;
        const emphasis = i === 0 || i === layers.length - 1;
        return (
          <li
            key={l.n}
            className={`grid grid-cols-[44px_1fr] items-baseline gap-4 px-5 py-4 md:grid-cols-[56px_220px_1fr] ${
              emphasis
                ? dark
                  ? "bg-gold-500 text-teal-950"
                  : "bg-teal-800 text-white"
                : dark
                  ? "border border-white/15 text-teal-50"
                  : "border border-rule bg-white text-charcoal"
            }`}
            style={{ marginInline: `${inset}%` }}
          >
            <span className={`num text-[12px] font-semibold ${emphasis ? "" : dark ? "text-gold-300" : "text-gold-700"}`}>{l.n}</span>
            <h3 className={`font-serif text-[1.2rem] leading-snug ${emphasis ? "" : dark ? "text-white" : "text-teal-900"}`}>{l.title}</h3>
            <p className={`col-span-2 text-[14px] leading-relaxed md:col-span-1 ${emphasis ? "opacity-90" : dark ? "text-teal-100" : "text-stone"}`}>{l.text}</p>
          </li>
        );
      })}
    </ol>
  );
}
