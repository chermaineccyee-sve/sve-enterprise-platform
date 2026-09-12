/**
 * Shared fictional test identities. None of these are real SVE/SKL
 * employees, real email addresses, or real passwords — per item 15 of the
 * Identity & Access Foundation PR brief. Real users are introduced later
 * through a controlled staging/UAT process, never via test fixtures.
 */
export const FICTIONAL_USERS = {
  pilot: { email: "test.pilot@example.test", password: "correct-horse-battery-staple-42!" },
  reviewer: { email: "test.reviewer@example.test", password: "another-fictional-passphrase-7!" },
  administrator: { email: "test.administrator@example.test", password: "fictional-admin-passphrase-9!" },
} as const;
