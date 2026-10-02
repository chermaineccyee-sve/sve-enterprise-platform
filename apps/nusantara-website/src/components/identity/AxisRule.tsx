import { NStar } from "./NStar";

/** Section transition: a hairline crossed by a short vertical axis at a four-point star. */
export function AxisRule({ tone = "light", className = "" }: { tone?: "light" | "dark"; className?: string }) {
  const dark = tone === "dark";
  return (
    <div aria-hidden className={`relative flex items-center ${className}`}>
      <span className={`h-px flex-1 ${dark ? "bg-white/15" : "bg-rule"}`} />
      <span className="relative mx-3 flex h-5 w-5 items-center justify-center">
        <span className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 ${dark ? "bg-white/20" : "bg-rule"}`} />
        <NStar className={`relative h-2.5 w-2.5 ${dark ? "text-gold-300" : "text-gold-500"}`} />
      </span>
      <span className={`h-px w-16 ${dark ? "bg-white/15" : "bg-rule"}`} />
    </div>
  );
}
