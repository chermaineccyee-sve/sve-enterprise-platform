# database

**Status: documentation pointer only — no schemas created in this PR.**

Future home of shared, platform-wide PostgreSQL migrations for `platform-services/*` (identity, organisation, HRMS, payroll, etc.), separate from `apps/svegip/netlify/database/migrations/`, which remains SVEGIP's own Netlify-DB-specific migration set and is unaffected by this PR.

No HRMS/Payroll/Accounting schema is created here yet — see `docs/architecture/data-and-database-conventions.md` for the conventions (migration naming/versioning, effective-dated records, ID strategy, audit columns, entity scoping, transactional integrity) that future migrations placed in this directory must follow.
