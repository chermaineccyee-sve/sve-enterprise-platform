"use client";

import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { StateGauge } from "@/components/identity/StateGauge";
import { track } from "@/lib/analytics";
import { routes } from "@/lib/routes";
import type { DimensionPreview, MarketIntel } from "./types";

/**
 * Where the selected market leads in the intelligence chain, inside the
 * dashboard. A connected Market State dimension opens in place (its state,
 * reading and supporting markets); a supporting market selects that market
 * in the workspace. "Open in Market State" leads to the full view.
 * Capabilities remain links. Uses only relationships the server resolved.
 */
export function ConnectedIntel({
  intel,
  dimensions,
  openId,
  onOpen,
  focusId,
  names,
  onPickMarket,
}: {
  intel: MarketIntel | undefined;
  dimensions: Record<string, DimensionPreview>;
  openId: string | null;
  onOpen: (id: string | null) => void;
  focusId: string;
  /** Short name per selectable instrument id. */
  names: Record<string, string>;
  onPickMarket: (id: string) => void;
}) {
  const dims = intel?.dimensions ?? [];
  const caps = intel?.capabilities ?? [];
  if (!dims.length && !caps.length) return null;
  const open = openId ? dimensions[openId] : null;

  return (
    <div className="border-t border-white/10 pt-4 text-[12.5px]">
      {dims.length > 0 && (
        <div>
          <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-teal-200">Market State</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {dims.map((d) => {
              const preview = dimensions[d.id];
              const on = openId === d.id;
              return (
                <li key={d.id}>
                  {preview ? (
                    <button
                      type="button"
                      aria-expanded={on}
                      aria-controls="dimension-preview"
                      onClick={() => {
                        onOpen(on ? null : d.id);
                        if (!on) track({ name: "dimension_previewed", dimension: d.id, instrument: focusId });
                      }}
                      className={`border px-2.5 py-1.5 text-left transition-colors duration-200 ${on ? "border-gold-400 bg-white/[0.06] text-white" : "border-white/20 text-teal-50 hover:border-gold-300"}`}
                    >
                      {d.label}: <span className="text-gold-200">{d.state.toLowerCase()}</span>
                    </button>
                  ) : (
                    <Link href={routes.dimension(d.id)} className="link-underline text-white hover:text-gold-200">
                      {d.label}: {d.state.toLowerCase()}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
          <AnimatePresence initial={false} mode="wait">
            {open && (
              <m.section
                key={open.id}
                id="dimension-preview"
                aria-label={`Market State: ${open.label}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-3 border-l-2 border-gold-400/70 pb-1 pl-4">
                  <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-teal-200">
                    Market State <span aria-hidden className="text-teal-300">·</span> {open.label}
                  </p>
                  <p className="mt-1.5 font-serif text-[1.35rem] leading-tight text-white">{open.state}</p>
                  <div className="mt-3">
                    <StateGauge id={`dim-${open.id}`} scale={open.stance.scale} position={open.stance.position} showLabels tone="dark" />
                  </div>
                  <p className="mt-3 text-[13.5px] leading-snug text-teal-50">{open.summary}</p>
                  {open.supportingMarkets.some((id) => names[id]) && (
                    <div className="mt-3">
                      <p className="text-[10.5px] uppercase tracking-[0.08em] text-teal-300">Supporting markets</p>
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {open.supportingMarkets
                          .filter((id) => names[id])
                          .map((id) => {
                            const sel = id === focusId;
                            return (
                              <li key={id}>
                                <button
                                  type="button"
                                  aria-pressed={sel}
                                  onClick={() => {
                                    onPickMarket(id);
                                    track({ name: "market_selected", instrument: id, surface: "dimension" });
                                  }}
                                  className={`px-2 py-1 text-[12px] font-medium uppercase tracking-[0.08em] transition-colors duration-200 ${sel ? "bg-gold-400 text-teal-950" : "bg-white/[0.07] text-teal-50 hover:bg-white/[0.14]"}`}
                                >
                                  {names[id]}
                                </button>
                              </li>
                            );
                          })}
                      </ul>
                    </div>
                  )}
                  <Link href={routes.dimension(open.id)} className="link-underline mt-3 inline-block text-[12.5px] text-gold-200 hover:text-white">
                    Open in Market State →
                  </Link>
                </div>
              </m.section>
            )}
          </AnimatePresence>
        </div>
      )}
      {caps.length > 0 && (
        <p className={`flex flex-wrap items-baseline gap-x-2 ${dims.length ? "mt-3" : ""}`}>
          <span className="text-teal-200">Capability</span>
          {caps.map((c, i) => (
            <span key={c.slug}>
              <Link href={routes.capability(c.slug)} className="link-underline text-white hover:text-gold-200">
                {c.name}
              </Link>
              {i < caps.length - 1 ? <span className="text-teal-300"> ·</span> : null}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
