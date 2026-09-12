# API Conventions

Status: conventions only. No `/api/v1/*` route is implemented by this PR. `apps/svegip`'s existing `/api/*` Netlify Functions (`/api/login`, `/api/session`, `/api/portal-data`, etc.) are unaffected and keep their current, unversioned paths and response shapes — migrating them to `/api/v1` is a future, deliberate step, not a rename done here.

## Versioning

- `/api/v1/` is the reserved namespace for the shared platform API described below. A breaking change to a resource's shape ships as `/api/v2/...` for that resource; `v1` keeps working until callers migrate.
- Versioning is per-namespace, not global — `/api/v1/hr` can reach `v2` independently of `/api/v1/documents` reaching `v2`.

## Namespace map (representative, not exhaustive — owner is the `platform-services/*` module of the same name unless noted)

| Namespace | Owning module |
|---|---|
| `/api/v1/auth`, `/api/v1/users`, `/api/v1/roles`, `/api/v1/permissions` | `identity` |
| `/api/v1/entities`, `/api/v1/employees` (org-structure fields) | `organisation` |
| `/api/v1/hr`, `/api/v1/leave`, `/api/v1/attendance`, `/api/v1/performance` | `hrms` |
| `/api/v1/payroll`, `/api/v1/payslips` | `payroll` |
| `/api/v1/claims` | `iclaims` |
| `/api/v1/accounting` | `accounting` |
| `/api/v1/datavault` | `data-vault` |
| `/api/v1/documents` | `documents` |
| `/api/v1/workflows`, `/api/v1/approvals` | `workflow` |
| `/api/v1/tasks`, `/api/v1/decisions` | future — not yet assigned to a module; closest existing analogue is SVEGIP's `management_decisions` (unaffected by this PR) |
| `/api/v1/notifications` | `notifications` |
| `/api/v1/audit` | `audit` |
| `/api/v1/system` | `core` (health, version, feature-flag surface — never business data) |

Do not implement an endpoint merely to claim coverage of this table — an empty route that returns nothing real is worse than no route (per the original master instruction's constraint, carried forward here).

## Response envelope

Every `/api/v1` response uses the shapes in `packages/types/src/api.ts`:

```jsonc
// success
{ "data": { /* resource */ }, "meta": { "correlationId": "..." } }

// list, paginated
{ "data": [ /* resources */ ], "meta": { "pagination": { "cursor": "...", "nextCursor": "...", "limit": 50 }, "correlationId": "..." } }

// error
{ "error": { "code": "ENTITY_ACCESS_DENIED", "message": "..." }, "meta": { "correlationId": "..." } }
```

- `error.code` is a stable, machine-readable string. Clients should branch on it, never on `message` text.
- `error.details`, if present, is structured — never a raw stack trace or raw database error.

## Correlation / request IDs

Every request is expected to carry (or be assigned, if absent) a correlation ID, propagated end-to-end: client → API layer → domain service → any downstream call → audit event (see `security-architecture.md`'s audit event contract, which includes no separate field for this because it's carried via `sessionId`/context, not duplicated). This is what lets a single iClaims submission be traced through manager approval, finance review, and its eventual accounting posting, per the "maintain end-to-end transaction IDs" requirement for iClaims → Accounting.

## Pagination

Cursor-based, not offset-based (offset pagination degrades under concurrent writes, which matters for audit/decision logs). See `Pagination` in `packages/types/src/api.ts`. A default `limit` and a hard maximum are each module's own responsibility to define and document in its own README once implemented.

## Authentication expectations

Every `/api/v1` route other than `/api/v1/auth` itself requires an authenticated session (see `packages/security`'s `SessionContext`). There is no anonymous/public `/api/v1` surface planned at this stage.

## Authorization expectations

Authentication alone is never sufficient. Every handler is expected to check, in this order:

1. Does the session have the required **permission**?
2. Does the session's **entity context** cover the target record's entity/business unit/department?
3. Does this specific action require **step-up MFA** (see `security-architecture.md`)?

A route must not skip step 2 merely because step 1 passed — role and entity access are independent grants (see `platform-architecture.md` "Multi-entity model").

## Entity-context handling

Requests that create or modify entity-scoped data must carry which legal entity/business unit/department the record belongs to, explicitly — never inferred solely from "whoever is logged in must mean their own entity," since a Management or Administrator session may legitimately act across entities. The API layer resolves and validates this against the session's actual entity access grants before a domain service ever sees the request (see `platform-architecture.md`'s layering).
