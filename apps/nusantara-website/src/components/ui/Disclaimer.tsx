import type { ReactNode } from "react";

/** Visible, non-dismissible disclaimer block. */
export function Disclaimer({
  title = "Important information",
  children,
  tone = "light",
  className = "",
}: {
  title?: string;
  children: ReactNode;
  tone?: "light" | "dark";
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <aside
      aria-label={title}
      className={`border-l-2 pl-5 ${dark ? "border-gold-400 text-teal-100" : "border-gold-500 text-stone"} ${className}`}
    >
      <p className={`eyebrow ${dark ? "text-gold-300" : "text-gold-700"}`}>{title}</p>
      <div className="mt-2 text-[13px] leading-relaxed">{children}</div>
    </aside>
  );
}
