"use client";

import { m, useScroll, useSpring } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { NStar } from "@/components/identity/NStar";
import { primaryNav } from "@/lib/site";
import { MasterLogo } from "./Logo";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Sticky header. Compacts after scroll; a gold rule glides to the hovered
 * item and rests under the current section; a hairline tracks reading
 * progress through the page.
 */
export function Navbar({ dataLabel, prototypeNote }: { dataLabel: string; prototypeNote: string | null }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [panelTop, setPanelTop] = useState(84);
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab" && panelRef.current) {
        const f = Array.from(panelRef.current.querySelectorAll<HTMLElement>("a,button"));
        if ((e.shiftKey && document.activeElement === f[0]) || (!e.shiftKey && document.activeElement === f[f.length - 1])) {
          e.preventDefault();
          toggleRef.current?.focus();
        }
      }
    };
    const mq = window.matchMedia("(min-width: 1280px)");
    const onMq = () => mq.matches && close(false);
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
    };
  }, [open, close]);

  const desktopItems = primaryNav.filter((i) => i.href !== "/" && i.href !== "/contact");
  const activeHref = desktopItems.find((i) => isActive(pathname, i.href))?.href ?? null;
  const ruleOn = hovered ?? activeHref;

  return (
    <>
      <header
        ref={headerRef}
        className={`sticky top-0 z-50 transition-[background-color,box-shadow,border-color] duration-500 ${
          scrolled || open
            ? "border-b border-rule bg-paper/92 shadow-[0_1px_30px_-14px_rgba(14,45,59,0.25)] backdrop-blur-md"
            : "border-b border-transparent bg-paper"
        }`}
        data-print="hide"
      >
        <div
          className={`container-site flex items-center justify-between gap-6 transition-[height] duration-500 ${
            scrolled ? "h-[64px] md:h-[70px]" : "h-[72px] md:h-[96px]"
          }`}
        >
          <div className={`origin-left transition-transform duration-500 ${scrolled ? "scale-[0.78]" : "scale-100"}`}>
            <MasterLogo />
          </div>

          <nav aria-label="Primary" className="hidden xl:block" onMouseLeave={() => setHovered(null)}>
            <ul className="flex items-center gap-7 2xl:gap-9">
              {desktopItems.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href} className="relative">
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onMouseEnter={() => setHovered(item.href)}
                      onFocus={() => setHovered(item.href)}
                      onBlur={() => setHovered(null)}
                      className={`relative inline-flex items-center gap-2 py-2 text-[13px] font-medium tracking-wide transition-colors ${
                        active || item.featured ? "text-teal-800" : "text-charcoal hover:text-teal-800"
                      }`}
                    >
                      {item.featured && <NStar className="h-2 w-2 text-gold-500" />}
                      {item.label}
                    </Link>
                    {ruleOn === item.href && (
                      <m.span
                        layoutId="nav-rule"
                        aria-hidden
                        className="absolute inset-x-0 -bottom-0.5 h-px bg-gold-500"
                        transition={{ type: "spring", stiffness: 420, damping: 36 }}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="hidden items-center gap-5 xl:flex">
            <Link
              href="/market-dashboard"
              className="group flex items-center gap-2 border-l border-rule pl-5 text-[11.5px] text-stone hover:text-teal-800"
              title={prototypeNote ? "Market data on this prototype is illustrative" : `Market data: ${dataLabel.toLowerCase()}`}
            >
              <NStar className="star-breathe h-2.5 w-2.5 text-gold-500" />
              <span>
                <span className="block font-semibold uppercase tracking-[0.14em] text-teal-800">Markets</span>
                <span className="block leading-tight">{dataLabel}</span>
              </span>
            </Link>
            <Link
              href="/contact"
              aria-current={isActive(pathname, "/contact") ? "page" : undefined}
              className="btn-fill inline-flex h-10 items-center border border-teal-800/40 px-5 text-[13px] font-medium tracking-wide text-teal-800 transition-colors duration-300 [--fill:var(--color-teal-800)] hover:text-white focus-visible:text-white"
            >
              Contact
            </Link>
          </div>

          <button
            ref={toggleRef}
            type="button"
            className="inline-flex h-11 items-center gap-3 px-1 text-[13px] font-medium tracking-wide text-teal-800 xl:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => {
              if (open) return close();
              setPanelTop(Math.round(headerRef.current?.getBoundingClientRect().bottom ?? 84));
              setOpen(true);
            }}
          >
            <span className="hidden sm:inline">{open ? "Close" : "Menu"}</span>
            <span aria-hidden className="relative block h-3 w-6">
              <span className={`absolute left-0 top-0 h-px w-6 bg-current transition-transform duration-300 ${open ? "translate-y-[6px] rotate-45" : ""}`} />
              <span className={`absolute left-0 top-[6px] h-px w-4 bg-current transition-opacity duration-200 ${open ? "opacity-0" : ""}`} />
              <span className={`absolute left-0 top-3 h-px w-6 bg-current transition-transform duration-300 ${open ? "-translate-y-[6px] -rotate-45" : ""}`} />
            </span>
            <span className="sr-only sm:hidden">{open ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
        <m.div aria-hidden className="absolute inset-x-0 bottom-0 h-px origin-left bg-gold-500/70" style={{ scaleX: progress }} />
      </header>

      <div
        id="mobile-nav"
        ref={panelRef}
        hidden={!open}
        style={{ top: panelTop }}
        className="fixed inset-x-0 bottom-0 z-40 overflow-y-auto border-t border-rule bg-paper xl:hidden"
        data-print="hide"
      >
        <nav aria-label="Mobile" className="container-site flex min-h-full flex-col py-6">
          <ul className="divide-y divide-rule-soft border-b border-rule-soft">
            {primaryNav.map((item, i) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => close(false)}
                    aria-current={active ? "page" : undefined}
                    className="group flex items-baseline justify-between gap-4 py-4"
                  >
                    <span className="flex items-baseline gap-4">
                      <span className="num w-6 text-xs text-mist">{String(i + 1).padStart(2, "0")}</span>
                      <span className={`font-serif text-[1.75rem] leading-tight ${active ? "text-teal-800" : "text-ink group-hover:text-teal-800"}`}>
                        {item.label}
                      </span>
                    </span>
                    {item.featured ? (
                      <NStar className="h-2.5 w-2.5 text-gold-500" />
                    ) : item.description ? (
                      <span className="hidden text-right text-sm text-stone sm:block">{item.description}</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
          {prototypeNote && (
            <p className="mt-auto flex items-center gap-2 pt-10 text-xs leading-relaxed text-stone">
              <NStar className="h-2 w-2 text-gold-500" />
              {prototypeNote}
            </p>
          )}
        </nav>
      </div>
    </>
  );
}
