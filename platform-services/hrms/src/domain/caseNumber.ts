/**
 * Human-readable case numbers are drawn from hr_lifecycle_case_seq (a
 * Postgres SEQUENCE) — never SELECT MAX(...)+1, never client-supplied.
 * The format below (HR-000001) is a foundation placeholder, not an
 * assumed real SVE case-numbering convention: no evidence in the current
 * codebase establishes one, mirroring the same documented-placeholder
 * approach already taken for employee numbers (platform-services/
 * organisation/src/domain/employeeNumber.ts) and Data Vault record codes.
 */
export function formatCaseNumber(seq: number): string {
  return `HR-${String(seq).padStart(6, "0")}`;
}
