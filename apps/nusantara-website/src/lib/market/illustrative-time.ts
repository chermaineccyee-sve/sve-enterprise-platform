/**
 * ILLUSTRATIVE SNAPSHOT TIME — the single source of truth for every date the
 * prototype shows next to illustrative market data.
 *
 * Genuine dataset fact: the illustrative series were generated around one
 * fixed reference time, ILLUSTRATIVE_AS_OF. Nothing was observed then either;
 * it is simply the anchor of the generated data.
 *
 * Presentation rule (management review prototype only): so the prototype does
 * not look stale on the day it is shown, illustrative data is *labelled* as a
 * snapshot at 09:00 MYT on the current Malaysia calendar date. Every
 * illustrative timestamp on screen (snapshot stamp, chart axes and tooltips)
 * is shifted by the same offset, so intervals are preserved. Values, series
 * and statistics are untouched. Always presented with "Illustrative".
 *
 * Data from a real provider (live / delayed) is never shifted: its own asOf
 * is shown as supplied.
 */

/** Anchor of the generated illustrative dataset (genuine; not an observation time). */
export const ILLUSTRATIVE_AS_OF = "2026-10-02T09:00:00.000Z";

const MYT_OFFSET_MS = 8 * 3600_000;
const SNAPSHOT_HOUR_MYT = 9;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 09:00 MYT on the Malaysia calendar date containing `nowMs` (Asia/Kuala_Lumpur: UTC+8, no DST). */
export function illustrativeSnapshotMs(nowMs: number): number {
  const myt = new Date(nowMs + MYT_OFFSET_MS);
  return Date.UTC(myt.getUTCFullYear(), myt.getUTCMonth(), myt.getUTCDate(), SNAPSHOT_HOUR_MYT) - MYT_OFFSET_MS;
}

/** Offset added to every illustrative timestamp for display. */
export function illustrativeShiftMs(nowMs: number): number {
  return illustrativeSnapshotMs(nowMs) - Date.parse(ILLUSTRATIVE_AS_OF);
}

const parts = (ms: number) => {
  const d = new Date(ms + MYT_OFFSET_MS);
  return {
    day: String(d.getUTCDate()).padStart(2, "0"),
    mon: MONTHS[d.getUTCMonth()],
    year: d.getUTCFullYear(),
    time: `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`,
  };
};

/** "03 OCT 2026 · 09:00 MYT / SGT" (Malaysia and Singapore are both UTC+8, no DST). */
export function formatSnapshotMyt(ms: number): string {
  const p = parts(ms);
  return `${p.day} ${p.mon.toUpperCase()} ${p.year} · ${p.time} MYT / SGT`;
}

/** Chart / tooltip label in UTC+8: "03 Oct 2026" or "03 Oct 2026, 09:00 MYT / SGT". */
export function formatMyt(ms: number, opts: { time?: boolean } = { time: true }): string {
  const p = parts(ms);
  return opts.time ? `${p.day} ${p.mon} ${p.year}, ${p.time} MYT / SGT` : `${p.day} ${p.mon} ${p.year}`;
}

/** Server render time (root layout): seeds the snapshot date for the server render and hydration. */
export function renderTimestamp(): number {
  return Date.now();
}
