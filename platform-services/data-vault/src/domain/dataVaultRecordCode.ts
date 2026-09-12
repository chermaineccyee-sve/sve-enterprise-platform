/**
 * Human-readable record code generation — ports the exact jurisdiction/
 * category shortening apps/svegip/data-vault/index.html's client-side
 * `saveRecord()` used (SVE-DV-<JUR>-<CAT>-<seq>), so record codes issued by
 * the new server-side path look identical to ones already seen in the
 * existing UI/prototype data. The sequence number is now a shared
 * Postgres SEQUENCE (or, for the in-memory repository, a store counter)
 * instead of `data.length + 1`, so it can never collide under concurrent
 * creates the way the client-only version could.
 */
const JURISDICTION_CODES: Record<string, string> = {
  Malaysia: "MY",
  Singapore: "SG",
  Labuan: "LAB",
};

export function jurisdictionCode(jurisdiction: string): string {
  return JURISDICTION_CODES[jurisdiction] ?? jurisdiction.slice(0, 3).toUpperCase();
}

export function categoryCode(category: string): string {
  return category.slice(0, 3).toUpperCase();
}

export function buildRecordCode(jurisdiction: string, category: string, seq: number): string {
  return `SVE-DV-${jurisdictionCode(jurisdiction)}-${categoryCode(category)}-${String(seq).padStart(4, "0")}`;
}
