import Link from "next/link";
import { STATUS_INFO, type Strategy } from "@/content/strategies";
import { Arrow } from "@/components/ui/CTA";

export function StatusLabel({ status, tone = "light" }: { status: Strategy["status"]; tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${dark ? "text-gold-300" : "text-gold-700"}`}>
      <span aria-hidden className="block h-1.5 w-1.5 rotate-45 border border-current" />
      {STATUS_INFO[status].label}
    </span>
  );
}

/** Capability / strategy card. Shows status explicitly; never implies an active product. */
export function StrategyCard({ strategy, index, variant = "row" }: { strategy: Strategy; index: number; variant?: "row" | "tile" }) {
  if (variant === "tile") {
    return (
      <Link
        href={`/strategies/${strategy.slug}`}
        className="group flex h-full flex-col border border-rule-soft bg-white p-6 transition-colors hover:border-teal-800"
      >
        <div className="flex items-center justify-between">
          <span className="num text-[12px] text-stone">{String(index + 1).padStart(2, "0")}</span>
          <StatusLabel status={strategy.status} />
        </div>
        <h3 className="mt-8 font-serif text-[1.55rem] leading-tight text-teal-900">{strategy.name}</h3>
        <p className="mt-3 text-[14.5px] leading-relaxed text-stone">{strategy.summary}</p>
        <span className="mt-auto inline-flex items-center gap-2 pt-6 text-[13px] font-medium text-teal-800">
          Capability overview <Arrow />
        </span>
      </Link>
    );
  }
  return (
    <Link
      href={`/strategies/${strategy.slug}`}
      className="group grid gap-3 border-b border-rule py-6 transition-colors hover:bg-white/60 md:grid-cols-12 md:items-center md:gap-6"
    >
      <span className="num text-[12px] text-stone md:col-span-1">{String(index + 1).padStart(2, "0")}</span>
      <h3 className="font-serif text-[1.6rem] leading-tight text-teal-900 transition-transform duration-300 group-hover:translate-x-1 md:col-span-4">
        {strategy.name}
      </h3>
      <p className="text-[14.5px] leading-relaxed text-stone md:col-span-5">{strategy.summary}</p>
      <span className="flex items-center justify-between gap-4 md:col-span-2 md:justify-end">
        <StatusLabel status={strategy.status} />
        <span className="text-teal-800">
          <Arrow />
        </span>
      </span>
    </Link>
  );
}
