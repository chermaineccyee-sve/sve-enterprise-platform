/**
 * The controlled allowlist of business-subject types a workflow instance
 * may reference (PR brief item 7). A `subjectType` is an opaque label —
 * never a table name, never SQL-derived — and `subjectId` is a bare UUID
 * with no foreign key onto any business domain's table. Validating
 * against this CODE-level registry (rather than a DB CHECK constraint)
 * lets a future domain register a new subject type without a migration
 * here, while still refusing anything not explicitly declared.
 *
 * No business domain is integrated by this PR — the one registered value
 * below is illustrative of the mechanism only (PR brief item 4: "build
 * the reusable engine ... but do not implement those business modules").
 */
const REGISTERED_SUBJECT_TYPES = new Set<string>([
  // Illustrative only — no HRMS integration exists yet. A future PR that
  // wires HRMS lifecycle cases into Workflow adds nothing here beyond
  // this same string; it does not need to modify this package.
  "hrms.lifecycle",
  // Fixture-only, for this package's own tests — never a real business
  // subject (mirrors HRMS/Organisation's "Fictional ... Test" fixture
  // convention).
  "test.fixture",
]);

export function isRegisteredSubjectType(subjectType: string): boolean {
  return REGISTERED_SUBJECT_TYPES.has(subjectType);
}

export function registeredSubjectTypes(): string[] {
  return [...REGISTERED_SUBJECT_TYPES];
}
