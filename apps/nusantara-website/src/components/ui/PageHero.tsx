import type { ReactNode } from "react";
import { Breadcrumb, type Crumb } from "./Breadcrumb";

/** Interior page masthead: breadcrumb, eyebrow, large serif title, lede. */
export function PageHero({
  eyebrow,
  title,
  lede,
  crumbs,
  aside,
  tone = "ivory",
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  crumbs: Crumb[];
  aside?: ReactNode;
  tone?: "ivory" | "teal";
  children?: ReactNode;
}) {
  const dark = tone === "teal";
  return (
    <section className={`relative overflow-hidden ${dark ? "on-dark bg-teal-900 text-white" : "bg-ivory"}`}>
      <HeroLines dark={dark} />
      <div className="container-site relative pt-10 pb-16 md:pt-14 md:pb-24">
        <Breadcrumb items={crumbs} tone={dark ? "dark" : "light"} />
        <div className="mt-14 grid gap-10 lg:grid-cols-12 lg:items-end md:mt-20">
          <div className="lg:col-span-8">
            <p className={`eyebrow ${dark ? "text-gold-300" : "text-gold-700"}`}>{eyebrow}</p>
            <h1 className={`display-xl mt-6 ${dark ? "text-white" : "text-teal-900"}`}>{title}</h1>
          </div>
          {lede && (
            <div className="lg:col-span-4 lg:pb-3">
              <p className={`lede ${dark ? "text-teal-100" : "text-stone"}`}>{lede}</p>
              {aside}
            </div>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}

/** Quiet concentric arcs echoing the Nusantara cover artwork. */
export function HeroLines({ dark = false }: { dark?: boolean }) {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute -right-40 -top-24 h-[620px] w-[620px] md:-right-24"
      viewBox="0 0 600 600"
      fill="none"
    >
      <circle cx="300" cy="300" r="290" stroke={dark ? "rgba(205,174,115,0.35)" : "rgba(184,149,90,0.45)"} strokeWidth="1" />
      <circle cx="300" cy="300" r="220" stroke={dark ? "rgba(255,255,255,0.10)" : "rgba(18,56,74,0.10)"} strokeWidth="1" />
      <circle cx="300" cy="300" r="150" stroke={dark ? "rgba(205,174,115,0.22)" : "rgba(184,149,90,0.28)"} strokeWidth="1" />
    </svg>
  );
}
