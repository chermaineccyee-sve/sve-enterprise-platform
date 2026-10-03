"use client";

import { useClock } from "@/hooks/useClock";

/**
 * CURRENT TIME in Malaysia (MYT, UTC+8) from the visitor's clock.
 *
 * Deliberately separate from market data: it never reads or formats a
 * market timestamp, and it is labelled "Current time" (not "live") so it
 * cannot suggest that illustrative prices are live.
 *
 * Hydration-safe: server and first client render show a fixed placeholder;
 * the time appears after hydration. Tabular digits keep the width steady.
 * Screen readers get a minute-level description and no live announcements.
 */
const TZ = "Asia/Kuala_Lumpur";
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const parts = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function myt(ms: number) {
  const p = Object.fromEntries(parts.formatToParts(ms).map((x) => [x.type, x.value]));
  const month = Number(p.month) - 1;
  return { day: p.day, mon: MONTHS[month], monthName: MONTH_NAMES[month], year: p.year, hh: p.hour, mm: p.minute, ss: p.second, month: p.month };
}

export function CurrentTime({
  seconds,
  tone = "dark",
  className = "",
}: {
  /** Show seconds on wider screens (Market Dashboard). Mobile always shows the compact form. */
  seconds: boolean;
  tone?: "light" | "dark";
  className?: string;
}) {
  const now = useClock(seconds ? "second" : "minute");
  const t = now === null ? null : myt(now);
  const label = tone === "dark" ? "text-teal-300" : "text-stone";
  const value = tone === "dark" ? "text-teal-50" : "text-charcoal";

  const full = t ? `${t.day} ${t.mon} ${t.year} • ${t.hh}:${t.mm}${seconds ? `:${t.ss}` : ""} MYT` : `-- --- ---- • --:--${seconds ? ":--" : ""} MYT`;
  const compact = t ? `${t.day} ${t.mon} · ${t.hh}:${t.mm} MYT` : "-- --- · --:-- MYT";

  return (
    <span className={`inline-flex items-baseline gap-2.5 whitespace-nowrap text-[11px] ${className}`}>
      <span aria-hidden className={`font-semibold uppercase tracking-[0.16em] ${label}`}>Current time</span>
      <time dateTime={t ? `${t.year}-${t.month}-${t.day}T${t.hh}:${t.mm}:${t.ss}+08:00` : undefined} className={`num text-[12px] tracking-[0.04em] ${value}`}>
        <span aria-hidden className="hidden sm:inline">{full}</span>
        <span aria-hidden className="sm:hidden">{compact}</span>
        <span className="sr-only">{t ? `Current time in Malaysia: ${Number(t.day)} ${t.monthName} ${t.year}, ${t.hh}:${t.mm}` : "Current time in Malaysia"}</span>
      </time>
    </span>
  );
}
