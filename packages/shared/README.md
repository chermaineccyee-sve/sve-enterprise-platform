# packages/shared

**Status: contracts only — no implementation.**

Infrastructure provider contracts (not security-specific — see `packages/security` for those) that keep the platform portable across SVE's private server and AWS, per `docs/architecture/deployment-portability.md`. No AWS resources are provisioned anywhere in this repository.

- `src/DatabaseProvider.ts` — private PostgreSQL today, AWS RDS PostgreSQL later.
- `src/StorageProvider.ts` — private/local object storage today, AWS S3 later.
- `src/LoggingProvider.ts` — structured local logging today, CloudWatch later.
- `src/NotificationProvider.ts` — channel-agnostic notification dispatch.

`apps/svegip` keeps using `@netlify/database` and `@netlify/functions` directly and is unaffected by this PR.
