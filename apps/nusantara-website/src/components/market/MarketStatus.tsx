import { NStar } from "@/components/identity/NStar";
import { formatTimestamp, STATUS_LABEL } from "@/lib/market/format";
import type { DataProvenance, DataStatus } from "@/lib/market/types";

const STATUS_STYLE: Record<DataStatus, string> = {
  live: "border-up/40 text-up",
  delayed: "border-teal-600/40 text-teal-700",
  "end-of-day": "border-teal-600/40 text-teal-700",
  illustrative: "border-gold-600/60 text-gold-800 bg-gold-100/60",
  placeholder: "border-mist text-stone",
};

/** Data status badge. Always icon + label — never colour alone. */
export function MarketStatus({
  status,
  delayMinutes,
  tone = "light",
  variant = "badge",
  className = "",
}: {
  status: DataStatus;
  delayMinutes?: number;
  tone?: "light" | "dark";
  /** "subtle" drops the box for dense grids; the icon + label remain. */
  variant?: "badge" | "subtle";
  className?: string;
}) {
  const dark = tone === "dark";
  if (variant === "subtle") {
    return (
      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${dark ? "text-gold-200" : "text-gold-800"} ${className}`}>
        <StatusIcon status={status} />
        {STATUS_LABEL[status]}
        {status === "delayed" && delayMinutes ? ` · ${delayMinutes} min` : null}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 border px-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] ${
        dark ? "border-gold-300/50 text-gold-200" : STATUS_STYLE[status]
      } ${className}`}
    >
      <StatusIcon status={status} />
      {STATUS_LABEL[status]}
      {status === "delayed" && delayMinutes ? <span className="font-normal normal-case tracking-normal">· {delayMinutes} min</span> : null}
    </span>
  );
}

function StatusIcon({ status }: { status: DataStatus }) {
  if (status === "live") return <span aria-hidden className="block h-1.5 w-1.5 rounded-full bg-current" />;
  if (status === "delayed" || status === "end-of-day")
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
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] ${dark ? "text-teal-200" : "text-stone"} ${className}`}>
      <MarketStatus status={provenance.status} delayMinutes={provenance.delayMinutes} tone={tone} />
      <DataSource source={provenance.source} />
      {showTime && <DataTimestamp asOf={provenance.asOf} />}
    </div>
  );
}
