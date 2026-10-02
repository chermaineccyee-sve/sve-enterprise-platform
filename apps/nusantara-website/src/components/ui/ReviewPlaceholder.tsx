import type { ReactNode } from "react";

/**
 * A clearly labelled management-review placeholder, used wherever factual
 * corporate information has not yet been supplied or approved. Never replace
 * one of these with invented content.
 */
export function ReviewPlaceholder({
  label = "Management review required",
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
    <div
      role="note"
      className={`border border-dashed px-5 py-4 ${
        dark ? "border-gold-300/50 bg-white/5 text-teal-100" : "border-gold-500/70 bg-gold-100/50 text-charcoal"
      } ${className}`}
    >
      <p className={`eyebrow flex items-center gap-2 ${dark ? "text-gold-300" : "text-gold-700"}`}>
        <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.2">
          <rect x="1" y="1" width="10" height="10" />
          <path d="M4 6h4M6 4v4" />
        </svg>
        {label}
      </p>
      <div className="mt-2 text-sm leading-relaxed">{children}</div>
    </div>
  );
}
