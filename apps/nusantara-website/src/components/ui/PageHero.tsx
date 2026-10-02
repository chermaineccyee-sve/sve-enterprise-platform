import type { ReactNode } from "react";
import { Lattice } from "@/components/identity/Lattice";
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

/** Quiet Nusantara lattice, partly off-canvas, as the masthead's graphic device. */
export function HeroLines({ dark = false }: { dark?: boolean }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute -right-32 -top-28 h-[600px] w-[600px] md:-right-16 ${dark ? "text-white/10" : "text-teal-800/[0.13]"}`}>
      <Lattice className="h-full w-full" strokeWidth={0.45} accent={dark ? "rgba(205,174,115,0.55)" : "rgba(184,149,90,0.6)"} />
    </div>
  );
}
