import Link from "next/link";
import type { ReactNode } from "react";

type CTAProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "text" | "light";
  className?: string;
};

const styles: Record<NonNullable<CTAProps["variant"]>, string> = {
  primary: "btn-fill h-12 px-6 bg-teal-800 text-white border border-teal-800 [--fill:var(--color-teal-950)]",
  secondary:
    "btn-fill h-12 px-6 border border-teal-800/35 text-teal-800 hover:border-teal-800 hover:text-white focus-visible:text-white [--fill:var(--color-teal-800)]",
  light: "btn-fill h-12 px-6 border border-white/30 text-white hover:text-teal-900 focus-visible:text-teal-900 [--fill:#fff]",
  text: "text-teal-800 hover:text-teal-950",
};

/** Call to action: fills directionally (left → right) and the arrow advances. Square corners by design. */
export function CTA({ href, children, variant = "primary", className = "" }: CTAProps) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-3 text-[14px] font-medium tracking-wide transition-colors duration-200 ${styles[variant]} ${className}`}
    >
      <span className={variant === "text" ? "link-underline" : ""}>{children}</span>
      <Arrow />
    </Link>
  );
}

export function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 10"
      className={`h-2.5 w-5 shrink-0 transition-transform duration-300 group-hover:translate-x-1 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    >
      <path d="M0 5h18M14 1l4 4-4 4" />
    </svg>
  );
}
