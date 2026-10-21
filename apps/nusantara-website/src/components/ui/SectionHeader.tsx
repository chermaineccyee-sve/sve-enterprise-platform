import type { ReactNode } from "react";

type SectionHeaderProps = {
  index?: string;
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  tone?: "light" | "dark";
  align?: "split" | "stacked";
  as?: "h1" | "h2";
  action?: ReactNode;
  className?: string;
};

/**
 * Editorial section header: numbered eyebrow over a thin gold-led rule,
 * then a serif title. "split" places the intro in a right-hand column.
 */
export function SectionHeader({
  index,
  eyebrow,
  title,
  intro,
  tone = "light",
  align = "split",
  as: H = "h2",
  action,
  className = "",
}: SectionHeaderProps) {
  const dark = tone === "dark";
  return (
    <div className={className}>
      <div className={`flex items-center gap-4 ${dark ? "text-gold-300" : "text-gold-700"}`}>
        {index && <span className="eyebrow num">{index}</span>}
        <span className="eyebrow">{eyebrow}</span>
        <span aria-hidden className={`h-px flex-1 ${dark ? "bg-white/15" : "bg-rule"}`} />
      </div>
      <div
        className={
          align === "split"
            ? "mt-8 grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-10"
            : "mt-8 flex flex-col gap-6"
        }
      >
        <H className={`display-l ${dark ? "text-white" : "text-teal-900"} ${align === "split" ? "lg:col-span-7" : ""}`}>
          {title}
        </H>
        {(intro || action) && (
          <div className={align === "split" ? "lg:col-span-5 lg:pb-2" : "max-w-2xl"}>
            {intro && <div className={`lede ${dark ? "text-teal-100" : "text-stone"}`}>{intro}</div>}
            {action && <div className="mt-6">{action}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
