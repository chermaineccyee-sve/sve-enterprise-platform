"use client";

import { NStar } from "@/components/identity/NStar";
import { useNow } from "@/hooks/useNow";
import { formatTimestamp } from "@/lib/market/format";
import { isStale, STATUS_LABEL } from "@/lib/market/status";
import type { DataProvenance, DataStatus } from "@/lib/market/types";

const STATUS_STYLE: Record<DataStatus, string> = {
  live: "border-up/40 text-up",
  delayed: "border-teal-600/40 text-teal-700",
  illustrative: "border-gold-600/60 text-gold-800 bg-gold-100/60",
  unavailable: "border-mist text-stone",
};
const STALE_STYLE = "border-down/50 text-down";

/** Data status badge. Always icon + label — never colour alone. */
export function MarketStatus({
  status,
  delayMinutes,
  stale = false,
  tone = "light",
  variant = "badge",
  className = "",
}: {
  status: DataStatus;
  delayMinutes?: number;
  /** A delayed or live value older than its threshold — shown as "Stale", never as current. */
  stale?: boolean;
  tone?: "light" | "dark";
  /** "subtle" drops the box for dense grids; the icon + label remain. */
  variant?: "badge" | "subtle";
  className?: string;
}) {
  const dark = tone === "dark";
  const label = stale ? "Stale" : STATUS_LABEL[status];
  const delay = !stale && status === "delayed" && delayMinutes ? delayMinutes : null;
  if (variant === "subtle") {
    return (
      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${dark ? "text-gold-200" : "text-gold-800"} ${className}`}>
        <StatusIcon status={status} stale={stale} />
        {label}
        {delay ? ` · ${delay} min` : null}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 border px-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] ${
        dark ? "border-gold-300/50 text-gold-200" : stale ? STALE_STYLE : STATUS_STYLE[status]
      } ${className}`}
    >
      <StatusIcon status={status} stale={stale} />
      {label}
      {delay ? <span className="font-normal normal-case tracking-normal">· {delay} min</span> : null}
    </span>
  );
}

function StatusIcon({ status, stale }: { status: DataStatus; stale: boolean }) {
  if (stale || status === "unavailable")
    return (
      <svg aria-hidden viewBox="0 0 10 10" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.2">
        <circle cx="5" cy="5" r="4" />
        <path d="M3 5h4" />
      </svg>
    );
  if (status === "live") return <span aria-hidden className="block h-1.5 w-1.5 rounded-full bg-current" />;
  if (status === "delayed")
    return (
      <svg aria-hidden viewBox="0 0 10 10" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.2">
        <circle cx="5" cy="5" r="4" />
        <path d="M5 2.6V5l1.6 1" />
      </svg>
    );
  return <NStar className="h-2 w-2" />;
}

export function DataTimestamp({ asOf, label = "As at", className = "" }: { asOf: string; label?: string; className?: string }) {
  return (
    <span className={`num ${className}`}>
      {label} <time dateTime={asOf}>{formatTimestamp(asOf)}</time>
    </span>
  );
}

export function DataSource({ source, className = "" }: { source: string; className?: string }) {
  return <span className={className}>Source: {source}</span>;
}

/** Re-evaluated in the browser: true once a delayed/live value has aged past its threshold. */
export function useIsStale(provenance: Pick<DataProvenance, "status" | "asOf" | "staleAfterMinutes"> | null | undefined): boolean {
  const now = useNow();
  return !!provenance && now !== null && isStale(provenance, now);
}

/**
 * Compact marker for dense surfaces (ribbon, rails, lists): renders nothing
 * unless the value has gone stale, so no surface presents old data as current.
 */
export function StaleMark({ provenance, tone = "light", className = "" }: { provenance: DataProvenance; tone?: "light" | "dark"; className?: string }) {
  const stale = useIsStale(provenance);
  if (!stale) return null;
  return (
    <span className={`text-[10.5px] font-semibold uppercase tracking-[0.12em] ${tone === "dark" ? "text-gold-200" : "text-down"} ${className}`} title={`Not current — last updated ${formatTimestamp(provenance.asOf)}`}>
      Stale
    </span>
  );
}

/** One line of provenance: status · source · timestamp. Used on every data surface. */
export function Provenance({
  provenance,
  tone = "light",
  className = "",
  showTime = true,
}: {
  provenance: DataProvenance;
  tone?: "light" | "dark";
  className?: string;
  showTime?: boolean;
}) {
  const dark = tone === "dark";
  const stale = useIsStale(provenance);
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] ${dark ? "text-teal-200" : "text-stone"} ${className}`}>
      <MarketStatus status={provenance.status} delayMinutes={provenance.delayMinutes} stale={stale} tone={tone} />
      <DataSource source={provenance.source} />
      {showTime && <DataTimestamp asOf={provenance.asOf} label={stale ? "Last updated" : provenance.status === "unavailable" ? "Checked" : "As at"} />}
      {provenance.attribution && provenance.status !== "illustrative" && <span>{provenance.attribution}</span>}
    </div>
  );
}
