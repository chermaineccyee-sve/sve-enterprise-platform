/**
 * Employee number formatting — deliberately a thin, replaceable policy
 * boundary, not a fixed convention. No evidence in the current codebase
 * establishes a real SVE employee-numbering format (apps/svegip's
 * employee_accounts table has no employee-number concept at all), so
 * `EMP-######` is documented here as a foundation placeholder, not an
 * assumed policy — see docs/architecture/organisation-employee-master.md
 * "Employee number generation". The actual uniqueness/concurrency
 * guarantee comes from `employee_number_seq` (a Postgres SEQUENCE, see
 * the migration), never from row counts or client-supplied values.
 */
export function formatEmployeeNumber(seq: number): string {
  return `EMP-${String(seq).padStart(6, "0")}`;
}
