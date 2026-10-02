import type { ReactNode } from "react";

/**
 * A quiet, clearly labelled note wherever factual information has not yet
 * been supplied or approved. The site-wide management-review banner is the
 * master disclosure; this stays visually secondary. Never replace one of
 * these with invented content.
 */
export function ReviewPlaceholder({
  label = "Pending approval",
  children,
  className = "",
  tone = "light",
}: {
  label?: string;
  children: ReactNode;
  className?: string;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <div role="note" className={`border-l-2 py-1 pl-4 ${dark ? "border-gold-300/60 text-teal-100" : "border-gold-500/70 text-stone"} ${className}`}>
      <p className={`text-[10.5px] font-semibold uppercase tracking-[0.14em] ${dark ? "text-gold-200" : "text-gold-800"}`}>{label}</p>
      <div className="mt-1 text-[13.5px] leading-relaxed">{children}</div>
    </div>
  );
}
