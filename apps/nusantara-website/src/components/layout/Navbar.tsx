"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { primaryNav } from "@/lib/site";
import { Logo } from "./Logo";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [panelTop, setPanelTop] = useState(84);
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
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
    const first = panelRef.current?.querySelector<HTMLElement>("a,button");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab" && panelRef.current) {
        const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>("a,button"));
        const firstEl = focusables[0];
        const lastEl = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          toggleRef.current?.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
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

  return (
    <>
    <header
      ref={headerRef}
      className={`sticky top-0 z-50 transition-[background-color,box-shadow,border-color] duration-300 ${
        scrolled || open
          ? "border-b border-rule bg-paper/95 shadow-[0_1px_24px_-12px_rgba(14,45,59,0.18)] backdrop-blur-md"
          : "border-b border-transparent bg-paper"
      }`}
      data-print="hide"
    >
      <div className="container-site flex h-[72px] items-center justify-between gap-6 md:h-[96px]">
        <Logo height={64} priority />

        <nav aria-label="Primary" className="hidden xl:block">
          <ul className="flex items-center gap-6 2xl:gap-8">
            {primaryNav.map((item) => {
              const active = isActive(pathname, item.href);
              if (item.href === "/contact") {
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`inline-flex h-10 items-center border px-5 text-[13px] font-medium tracking-wide transition-colors ${
                        active
                          ? "border-teal-800 bg-teal-800 text-white"
                          : "border-teal-800/30 text-teal-800 hover:border-teal-800 hover:bg-teal-800 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              }
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`group relative inline-flex items-center gap-2 py-2 text-[13px] font-medium tracking-wide transition-colors ${
                      item.featured ? "text-teal-800" : "text-charcoal hover:text-teal-800"
                    }`}
                  >
                    {item.featured && (
                      <span aria-hidden className="block h-[5px] w-[5px] rotate-45 bg-gold-500" />
                    )}
                    {item.label}
                    <span
                      aria-hidden
                      className={`absolute inset-x-0 -bottom-0.5 h-px origin-left bg-gold-500 transition-transform duration-300 ${
                        active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                      }`}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

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
            <span
              className={`absolute left-0 top-0 h-px w-6 bg-current transition-transform duration-300 ${
                open ? "translate-y-[6px] rotate-45" : ""
              }`}
            />
            <span
              className={`absolute left-0 top-[6px] h-px w-4 bg-current transition-opacity duration-200 ${
                open ? "opacity-0" : ""
              }`}
            />
            <span
              className={`absolute left-0 top-3 h-px w-6 bg-current transition-transform duration-300 ${
                open ? "-translate-y-[6px] -rotate-45" : ""
              }`}
            />
          </span>
          <span className="sr-only sm:hidden">{open ? "Close menu" : "Open menu"}</span>
        </button>
      </div>

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
                      <span
                        className={`font-serif text-[1.75rem] leading-tight ${
                          active ? "text-teal-800" : "text-ink group-hover:text-teal-800"
                        }`}
                      >
                        {item.label}
                      </span>
                    </span>
                    {item.featured ? (
                      <span className="eyebrow text-gold-700">Featured</span>
                    ) : item.description ? (
                      <span className="hidden text-right text-sm text-stone sm:block">{item.description}</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-auto pt-10 text-xs leading-relaxed text-stone">
            Management-review prototype. Market information shown on this website is illustrative.
          </p>
        </nav>
      </div>
    </>
  );
}
