# SVE Data Vault — Server-Side Remediation (PR #5)

Status: **implemented, PR draft, not deployed.** This document records what
changed, why, and what is deliberately still open. It supersedes nothing in
`docs/architecture/data-vault-rebuild-assessment.md` (the read-only
assessment of the preserved `reference/svegip-feature-data-vault-rebuild`
branch, still untouched and unmerged) — that document's findings are
referenced below where relevant.

**This PR is Data Vault server-side remediation. It is not, and does not
constitute, the SVEGIP Identity migration** (moving `apps/svegip`'s own
login/session system onto `platform-services/identity`). That migration
remains future, separately-scoped work — see §9 "SVEGIP/Identity
transitional authentication boundary" for exactly what this PR does
instead.

**Revision note (PR #5 review correction):** the Data Vault implementation
originally lived inside `platform-services/identity`. Following review, it
has been moved into its own package, `platform-services/data-vault`, so
that Identity — an upstream security capability — carries no knowledge of
Data Vault, a business/intelligence domain that consumes it. This revision
also adds explicit CSRF/origin protection for the transitional SVEGIP
cookie bridge's state-changing requests. See §5 and §10.

## 1. The CRITICAL finding, and what remediates it

`SVEGIP_ENTERPRISE_ASSESSMENT.md` recorded that `apps/svegip/data-vault/
index.html`'s actual business content was stored entirely in browser
`localStorage`. PR #5 fixes this: Data Vault evidence records are now
created, listed, and read through a real PostgreSQL-backed API
(`/api/v1/data-vault/*`), independently authenticated and authorized on the
server for every request. The browser is no longer the authoritative store
for any Data Vault business record.

## 2. Before/after architecture

**Before:**
```
Data Vault UI (data-vault/index.html)
      ↓
localStorage.getItem/setItem('sveRecords')   <-- authoritative, browser-only
```
The page's `/api/session` call only ever gated *page visibility* (via the
existing SVEGIP login + the `protect-data-vault.mts` edge function) — it
never touched record data. No server ever saw a record's content,
classification, or entity.

**After:**
```
Data Vault UI (data-vault/index.html)
      ↓  fetch() — /api/v1/data-vault/*
Data Vault API (platform-services/data-vault/src/api/routes/dataVault.ts)
      ↓
SVE Identity / Session  (native bearer session, OR the transitional
      ↓                  SVEGIP session-cookie bridge — see §9)
CSRF/Origin check  (cookie-authenticated state-changing requests only — §10)
      ↓
Server-side Authorisation  (Identity's rbacService.authorize(), default-deny)
      ↓
Data Vault Domain Service  (platform-services/data-vault/src/services/dataVaultService.ts)
      ↓
Repository Layer  (platform-services/data-vault/src/repositories/postgres/pgDataVaultRepository.ts)
      ↓
PostgreSQL  (data_vault_records, data_vault_record_versions)
      ↓
Security / Data Audit  (security_audit_events, via Identity's auditService.ts)
```
Every box from "SVE Identity / Session" down to "Security / Data Audit"
that says "Identity's ..." is code this package *depends on and imports*
from `platform-services/identity` — none of it is reimplemented here. See
§5.

## 3. Evidence-based inventory (current code, not old docs)

Verified directly against `apps/svegip/data-vault/index.html` as it exists
on `main` before this PR — not assumed from prior documentation.

| Current Data Vault feature | Current browser persistence | Current record type | Read path | Write path | Delete/archive path | Current security boundary | Server-side replacement |
|---|---|---|---|---|---|---|---|
| Evidence record list/search/filter | `localStorage['sveRecords']`, falling back to a hard-coded `seed` array | `{id, jur, topic, source, tier, date, conf, status}` | `renderRecords()` filters the in-memory `data` array by tier + free-text search | none (read-only) | none | Page-level only: the Netlify Edge Function `protect-data-vault.mts` + `/api/vault-authorize` gate whether the page loads at all, based on the account's `data_vault_access` flag; no per-record check ever existed | `GET /api/v1/data-vault/records` — server-side filter + per-row `rbacService.authorize()` (§7) |
| New Evidence Record form (`#recordModal`) | `saveRecord()` pushes into the same `data` array and rewrites `localStorage['sveRecords']` | same shape; `id` generated client-side as `SVE-DV-<jur><cat>-<seq>` from `data.length+1` (collision-prone under concurrent tabs) | n/a | `saveRecord()` | n/a | None — any signed-in Data Vault page visitor could write | `POST /api/v1/data-vault/records` — server-generates the record code from a Postgres sequence, requires `data_vault.records.create[.privileged]` |
| Evidence detail drawer (`openEvidence()`) | reads from the same `data` array, with a small hard-coded fallback map for three IDs not in `data` | same shape | `data.find(x=>x.id===id)` | n/a | n/a | None | `GET /api/v1/data-vault/records/:id` — 404 (not 403) for both a nonexistent id and one the caller lacks access to (§7) |
| "Data ID" audit panel (`sveLoadDataIDs`/`sveNextDataID`) | `localStorage['sve_data_id_registry_v1']` | `{seq, id: 'SVE-DATA-NNNNNN', issued, topic, jurisdiction, status}` | scraped from a regex match over the page's own rendered text, or read back from localStorage | `sveNextDataID()` (never actually called anywhere in the page — dead code) | n/a | None | Persistence removed outright — the panel is now purely a derived, ephemeral view of the current page; no replacement store was needed because it was never a real record store |
| Update / classification change / status transition | **did not exist** — no edit UI, no way to move a record between `Requires Review`/`Report Ready`/`Monitoring` | — | — | — | — | — | Added because the RBAC/classification remediation requires it: `PATCH /api/v1/data-vault/records/:id` |
| Delete / archive | **did not exist** — no delete or archive affordance anywhere in the current UI | — | — | — | — | — | Added as the safe alternative to a future delete feature: `POST /api/v1/data-vault/records/:id/archive` (soft status transition, never a DB row deletion) |
| Insight Notes, Report Data Packs, Client Workspaces, Project Command Centre, Review Queue, Risk register | none — these are static-markup prototype screens with hard-coded numbers and `showToast()`/`alert()` stubs on every action | — | — | — | — | — | **Not touched.** Nothing here reads or writes any data store today (not even localStorage), so there is nothing to remediate; building real persistence for them would be a Data Vault *redesign*, explicitly out of scope for this PR |
| Page-level Data Vault access gate | n/a (not client-side at all) | n/a | `netlify/edge-functions/protect-data-vault.mts` calls `/api/vault-authorize`, which calls `resolveLiveSecurityContext()` against `employee_accounts.data_vault_access` | n/a | n/a | Real, already server-side | **Unchanged.** This continues to gate whether the page loads; the new API adds record-level authorization *underneath* it, per §7 |
| "Documents & Data Rooms" / controlled-document API (`documents.mts`, `controlled_documents` table) | Postgres already, via `@netlify/database` | separate feature (document metadata + storage references), not Data Vault evidence records | already real | already real | already real | already real (classification + explicit grants + management-role check) | **Not touched.** This is a distinct, already-remediated feature; confirmed by reading `netlify/functions/documents.mts` before writing any code, not assumed |

## 4. Server-side record model

`database/migrations/002_data-vault-foundation/migration.sql` adds exactly
two tables — no tags, no matter/client linkage, no risk metadata, because
none of those exist in current Data Vault functionality (see the inventory
above):

- **`data_vault_records`** — `id` (UUID), `record_code` (server-generated,
  unique, e.g. `SVE-DV-MY-REG-0001`), `legal_entity_id` (FK
  `legal_entities`, the access-control axis), `jurisdiction`/`category`/
  `topic`/`source`/`tier`/`confidence`/`checked_date` (the existing
  descriptive fields, kept as free text — their option lists live in the
  UI, not the schema), `classification` (the 5-value enum, CHECK
  constrained), `status` (`Requires Review`/`Report Ready`/`Monitoring`/
  `Archived`, CHECK constrained), `version`, `created_by`/`updated_by`/
  timestamps, `archived_at`/`archived_by`.
- **`data_vault_record_versions`** — one row per update, with a full field
  snapshot (`snapshot JSONB`) of the record *before* the change, plus
  `change_note`/`changed_by`/`changed_at`. This table sits behind the same
  database access control as the live table; it is not the audit trail
  (see §8 — the audit trail deliberately does *not* receive this snapshot).

**Legal entity vs. jurisdiction:** these are two different axes and the
schema keeps them separate. `jurisdiction` (Malaysia/Singapore/Labuan/Hong
Kong/UAE/Timor-Leste/ASEAN/Global) is descriptive content — what the
evidence is *about*. `legal_entity_id` is the access-control boundary — who
*owns*/may see the record, one of the three seeded `legal_entities` rows
(SVE International Pte. Ltd. Singapore, SVE International Sdn. Bhd.
Malaysia, SK Lai & Partners Malaysia). The existing UI never had a legal
entity concept at all; the "Legal Entity" field added to `#recordModal` is
a necessary, minimal addition required directly by the RBAC/entity
remediation this PR was asked to build, not a redesign.

**Classification is never client-authoritative.** The client sends a
*requested* classification at create/update time; the server independently
verifies the caller's permission covers it (§7) before accepting it, and
the database CHECK constraint rejects anything outside the five defined
values regardless.

**Record codes are server-generated.** `data_vault_record_seq` (a Postgres
`SEQUENCE`) replaces the old client-side `data.length + 1`, which could
collide under concurrent tabs/users. A client-supplied `id`/`recordCode` in
a create request is always ignored (see the mass-assignment test in §14).

## 5. Module ownership and dependency direction

Data Vault is a business/intelligence domain that *consumes* Identity, an
upstream security capability — never the reverse. Concretely:

```
platform-services/
├── identity/        identity/access/session/MFA/audit only —
│                     no Data Vault import, type, or route anywhere in it
│
└── data-vault/       domain, repositories, services, API/routes, tests —
                       depends on Identity's contracts/services, never
                       duplicates their implementation
```

- `platform-services/identity/src/container.ts` and `src/api/http.ts`
  build and serve only Identity's own routes (`/api/v1/auth/*`,
  `/api/v1/users/me`). Neither has ever imported anything from
  `platform-services/data-vault`.
- `platform-services/data-vault/src/composition/container.ts` is the
  **composition root** where Identity and Data Vault are wired together —
  placed on the dependent side (Data Vault), not inside Identity, per the
  review correction. It imports Identity's Postgres repositories
  (`pgUserRepository`, `pgSessionRepository`, `pgRbacRepository`,
  `pgAuditRepository`, `pgOrganisationRepository`), its `sessionService`/
  `rbacService`/`auditService`, its migration runner
  (`scripts/migrate.ts`), and its SVEGIP session-bridge verification
  (`svegipSessionBridge.ts`) — all by relative source-path import, since
  this monorepo has no package-registry/workspace boundary between
  sibling `platform-services/*` packages yet.
- `platform-services/data-vault/src/services/dataVaultService.ts` depends
  on Identity's `RbacService`, `AuditService`, and `OrganisationRepository`
  *contracts* (imported types), never a copy of their logic. Its own
  domain errors (`NotFoundError`, `ValidationError`,
  `CsrfOriginRejectedError`) are Data-Vault-specific and live in this
  package; Identity's authentication-outcome errors
  (`SessionInvalidError`, `AccountDisabledError`,
  `IdentityNotProvisionedError`, `ForbiddenError`) are imported from
  Identity, since those *are* Identity contracts.
- Identity's `auditService.record()` accepts a plain `action: string`
  (widened from a closed union during this correction) precisely so
  Identity does not need to know Data Vault's action vocabulary
  (`data_vault.record.created`, etc.) in advance — encoding a consumer's
  vocabulary into the provider's types would itself be the ownership
  violation this correction fixes. `IdentitySecurityAction` remains as a
  convenience type for Identity's own call sites only.

**A known, documented consequence of source-path imports:** because Data
Vault's composition root reaches into Identity's `.ts` files directly,
Node resolves those files' own dependencies (`pg`) relative to *their*
location, inside `platform-services/identity/node_modules`. Data Vault's
own `package.json` therefore declares **zero runtime dependencies** — see
`platform-services/data-vault/README.md`. The practical consequence is
that both packages' `npm ci` must run before Data Vault's tests can pass
(see `.github/workflows/ci.yml`'s `validate-data-vault` job, and §15). If
this coupling becomes a maintenance burden at a later date, the fix is an
npm workspace or an installable internal package for Identity's consumed
pieces — not duplicating their implementation into Data Vault.

**In-memory test stores are likewise separate.** Data Vault's own
`src/repositories/memory/inMemoryStore.ts` holds only Data Vault records —
it does not merge with, or duplicate, Identity's `InMemoryStore`
(users/roles/entity grants/audit events). Unit tests exercising
`dataVaultService` construct one instance of each and wire them together
via dependency injection, exactly mirroring how the two packages compose
in production against real Postgres.

## 6. Data Vault API

All routes are under `/api/v1/data-vault/`, following the existing
`/api/v1` envelope (`docs/architecture/api-conventions.md`, whose
`sendSuccess`/`sendError`/`readJsonBody` helpers this package imports from
Identity as generic, non-security HTTP plumbing) and served by this
package's own standalone HTTP server
(`platform-services/data-vault/src/api/http.ts`, `src/server.ts`) — it
does not mount into, or get mounted by, Identity's server:

| Method | Path | Purpose |
|---|---|---|
| GET | `/records` | List, filtered server-side by `legalEntityId`, `classification`, `status`, `tier`, `search`, `checkedFrom`/`checkedTo` — authorization applied per row *before* any row is returned (never "fetch all, hide client-side") |
| GET | `/records/:id` | Single record; 404 (not 403) for both a nonexistent id and one the caller isn't authorized for |
| POST | `/records` | Create — explicit field allowlist, ignores any client-supplied `id`/`status`/`recordCode`/`createdBy`; CSRF/origin-checked for cookie auth (§10) |
| PATCH | `/records/:id` | Update — classification/entity changes are independently re-authorized against the *new* value, not just the record's current value; CSRF/origin-checked for cookie auth (§10) |
| POST | `/records/:id/archive` | Soft status transition to `Archived`; never deletes the row; CSRF/origin-checked for cookie auth (§10) |
| GET | `/legal-entities` | Reference data for the create-form's "Legal Entity" dropdown; requires authentication only, no Data Vault-specific permission (the list of entities isn't itself classification-bearing) |

No hard-delete route exists, and none was added — the current UI has no
delete affordance to preserve, and archive/supersede is preferred over
destructive deletion.

## 7. RBAC / entity / classification enforcement

Data Vault is the first real business-data consumer of Identity's
`rbacService.authorize()`. Every route re-derives ALLOW/DENY itself, from
the caller's own `userId` — never from anything the client claims:

```
Who is the user?            -> requireDataVaultActor() (§9, §10)
Is the session valid?       -> sessions.validateSession() / SVEGIP bridge + Identity user lookup
Is this a trusted request?  -> CSRF/origin check for cookie-authenticated unsafe methods (§10)
What permission is required? -> data_vault.records.{read,create,update,archive}[.privileged]
Which entity does the record belong to? -> record.legalEntityId (server column, never client-trusted after creation)
What is the record's classification?    -> record.classification (server column, CHECK-constrained)
Does the user have authority over this record/action? -> rbacService.authorize({userId, permissionKey, target})
ALLOW / DENY  -> default-deny; a missing or ambiguous input denies
```

**Two-tier permissions for PRIVILEGED.** Identity's `rbacService.
authorize()` resolves a *single* permission key to a *single, fixed*
classification ceiling — there is no per-role variation on one key. To
make PRIVILEGED "require explicit permission" without modifying that
already-merged service, each action has two permission keys: an ordinary
one (e.g. `data_vault.records.read`, typically ceilinged at CONFIDENTIAL)
and a `.privileged` one (ceilinged at PRIVILEGED), granted only to roles
explicitly authorized for privileged/SKL-adjacent material. A request is
allowed if the ordinary key covers it; only when the *record* is PRIVILEGED
does the service also try the `.privileged` key. Holding the ordinary key
never implies the privileged one.

**Visibility before authority, for existing-record writes.** `PATCH`/
`archive` first check the caller can *see* the record (the read
permission) — if not, the response is the same 404 as a nonexistent id,
exactly like a `GET`. Only once visibility is established does the service
check the actual write permission, returning 403 if that specific
permission is missing — this avoids the confusing case of telling someone
who can already see a record via `GET` that it "doesn't exist" merely
because they lack `update`/`archive`.

**Verified scenarios** (unit + integration tests, §15): SVE Malaysia access
does not imply SVE Singapore access; Singapore's Group-Headquarters status
does not imply SK Lai & Partners access; a Group-scope grant does not imply
PRIVILEGED access; an "Administrator"-style role with only the ordinary
read permission does not gain PRIVILEGED access merely by being
group-scoped; a classification ceiling below a record's classification
denies regardless of how broad the entity grant is; a denied caller
requesting a record by its exact UUID gets the same response as a
nonexistent UUID; list/search never returns a row the caller can't
individually pass authorization for.

## 8. Audit behaviour

Every Data Vault write, plus reads of sensitive records, go through
Identity's existing `auditService.record()` into `security_audit_events` —
not a new, parallel audit table. Actions recorded: `data_vault.record.
{created,viewed,updated,classification_changed,entity_changed,archived}`
and `data_vault.access.denied` (recorded specifically for a *denied direct
access attempt* — someone requesting a known id they can't reach — since
that is the security-relevant event; silently-filtered list rows are not
individually audited, to avoid an audit row per hidden row on every list
call). `viewed` is recorded only for CONFIDENTIAL/RESTRICTED/PRIVILEGED
records, not every PUBLIC/INTERNAL view, to keep the log meaningful rather
than noisy.

**Audit model does not duplicate record content.** `change_before`/
`change_after` on these events carry only small transition metadata
(status/classification/entity before → after), never the record's
`topic`/`source`/free-text content — that full-fidelity history lives only
in `data_vault_record_versions`, which is protected by the same database
access control as the live record, not exposed through the audit trail.
Verified directly by a unit test asserting a record's actual confidential
topic text never appears anywhere in the audit store.

## 9. SVEGIP/Identity transitional authentication boundary

**The constraint:** Identity was built in parallel with `apps/svegip`'s
existing authentication; SVEGIP has not been migrated onto it. PR #5 must
authenticate Data Vault API requests without (a) silently replacing SVEGIP
login, (b) maintaining two unrelated sources of authority for the same
access decision, or (c) trusting anything the frontend/cookie claims about
identity or role.

**The bridge, exactly as implemented** (Identity's `src/services/
svegipSessionBridge.ts`, Data Vault's `src/api/middleware/
dataVaultActor.ts`):

1. `requireDataVaultActor()` first tries a native Identity bearer session
   (`Authorization: Bearer ...`, `sessions.validateSession()`) — the same
   path every Identity route uses. This path is tagged `authMethod:
   "bearer"` — see §10 for why that tag matters.
2. If absent, it falls back to apps/svegip's own `svegip_session` cookie.
   It **cryptographically verifies that cookie's existing HMAC-SHA256
   signature** (`apps/svegip/netlify/functions/_auth-core.mts`/
   `login.mts`'s own scheme, keyed by the shared `SVEGIP_SESSION_SECRET`)
   — the identical trust boundary SVEGIP itself already relies on, not a
   new or weaker one. No new authentication mechanism is introduced. This
   verification function (`verifySvegipSessionCookie`) lives in Identity
   as a reusable capability — it has no Data-Vault-specific knowledge, and
   Identity does not depend on Data Vault to expose it (§5).
3. It extracts **only the verified email** from that cookie. The
   `role`/`unit`/`permissions`/`dataVaultAccess` fields embedded in the
   cookie are read by no code in this bridge — recreating "two sources of
   authority" was the one thing this design had to avoid, and the
   embedded role is exactly what that would mean.
4. This path is tagged `authMethod: "svegip-cookie"`, which gates the
   CSRF/origin check described in §10 before any further step.
5. It looks up a `users` row by that verified email in **Identity's own
   database**. If none exists, the request is denied
   (`IDENTITY_NOT_PROVISIONED`, 403) — SVEGIP authenticating someone is
   never, by itself, sufficient to authorize them for Data Vault. If a row
   exists, every subsequent authorization decision for the request comes
   *solely* from that user's own role assignments and entity-access grants
   in Identity's RBAC tables (§7) — never from the cookie again.

This makes **Identity's own database the single, sole authority for
Data Vault authorization**, while SVEGIP remains the sole authority for
*authenticating* who is making the request during this transitional
period. Provisioning (creating the corresponding `users` row and granting
it roles/entity access) is a manual administrative step in this
foundation — no bulk/automatic provisioning of SVEGIP's `employee_accounts`
into Identity was performed or attempted, and none was needed for this PR
(no real users are seeded either side).

**Configuration:** `SVEGIP_SESSION_SECRET` is resolved through Identity's
`SecretsProvider` abstraction and its `loadSvegipBridgeSecret()` helper,
called from Data Vault's composition root — Data Vault documents and reads
this value from its **own** `.env.example` (not Identity's; Identity has
no route that consumes it directly). It **must be set to the exact same
value** already configured for `apps/svegip`'s Netlify environment. This is
not a new secret; it lets Data Vault verify signatures SVEGIP already
produces. If unset, requests bearing only a SVEGIP cookie are simply not
authenticated (never a crash, never a fallback to trusting the cookie).

**This is not the SVEGIP Identity migration.** SVEGIP's login endpoint,
password storage (`employee_accounts.password_hash`, PBKDF2/210000
iterations), session issuance, and every other SVEGIP feature are
completely untouched. The migration path this bridge points toward is: (1)
provision real Identity users/roles/entity grants for real SVEGIP
employees who need Data Vault access (administrative step, out of scope
here); (2) eventually replace SVEGIP's own login with a call into
Identity's `/api/v1/auth/login`, at which point this bridge — and the
`SVEGIP_SESSION_SECRET` dependency — can be deleted entirely, since every
caller would already be carrying a native Identity bearer session.

## 10. CSRF/origin protection for the SVEGIP cookie bridge

### Actual SVEGIP cookie-issuance findings (inspected, not assumed)

Read directly from `apps/svegip/netlify/functions/login.mts`, `_auth-
core.mts`, `logout.mts`, and `session.mts` before designing this
protection:

- **Issuance** (`login.mts`): `Set-Cookie: svegip_session=<payload>.
  <signature>; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800` (8
  hours). The same attributes are used to clear it on logout.
- **No `Domain` attribute is set anywhere.** This makes the cookie
  *host-only*: the browser will only ever attach it to requests to the
  exact host that issued it. Practical consequence: the SVEGIP bridge is
  reachable at all only once a future same-origin reverse proxy (§11)
  makes `/api/v1/data-vault/*` appear to be served from that same host —
  before that, the browser simply never sends `svegip_session` to a
  separately-hosted Data Vault service, regardless of anything this PR
  does. This is a structural mitigation already present in SVEGIP's
  existing cookie, not something this PR relies on in place of the checks
  below.
- **`HttpOnly`** — the cookie is unreadable by JavaScript. It defends
  against a completely different threat (XSS token theft), not CSRF: a
  malicious cross-origin page cannot read the cookie's value, but the
  browser still attaches it automatically to a same-host request the page
  triggers, which is exactly the CSRF vector this section addresses.
- **`SameSite=Lax`** — genuinely helpful, blocking the cookie from being
  attached to most cross-site `POST`/`fetch`/`XHR` requests a hostile page
  might trigger. It is not a complete defense: `Lax` still permits the
  cookie on a top-level cross-site *navigation* (a plain link/form `GET`,
  and in some older/misconfigured browsers a `POST` shortly after one),
  and provides no protection at all once the reverse proxy in §11 makes
  Data Vault same-site with SVEGIP, since same-site requests are not
  cross-site by definition — an attacker's page loaded via `<script>`/
  `fetch` from *any* origin can still trigger a same-site `POST` that
  carries the cookie automatically. The PR review correctly identified
  that relying on `SameSite` alone here would be insufficient — hence the
  explicit check below.
- **No CSRF token of any kind is embedded in or alongside this cookie.**
  SVEGIP's own endpoints have no CSRF defense beyond `SameSite=Lax` today;
  this PR does not change SVEGIP's own code, but Data Vault cannot inherit
  that same gap for its own state-changing routes.

### Design

`requireDataVaultActor()` (`platform-services/data-vault/src/api/
middleware/dataVaultActor.ts`) tags every resolved actor with
`authMethod: "bearer" | "svegip-cookie"`. The CSRF/origin check is
conditioned on that tag, applied only where the threat model is real:

- **`authMethod: "bearer"` — no check, ever.** A bearer token is placed in
  an `Authorization` header by the calling code, not attached
  automatically by the browser to a request it didn't construct. CSRF
  does not apply to this path, and the implementation never even inspects
  `Origin`/`Referer` for a bearer-authenticated request — see the "native
  bearer-token calls" test in §15.
- **`authMethod: "svegip-cookie"` — checked for unsafe methods only.**
  For `POST`/`PUT`/`PATCH`/`DELETE`, the request's `Origin` header (or,
  if absent, the origin parsed from `Referer`) must exactly match one of
  a configured allowlist (`SVE_DATA_VAULT_TRUSTED_ORIGINS`, comma-
  separated exact origins — see `platform-services/data-vault/
  .env.example`). Missing both headers, or a value not in the allowlist,
  is **default-deny**: `CsrfOriginRejectedError` → HTTP 403
  `CSRF_ORIGIN_REJECTED`. `GET`/`HEAD` (and any other safe method) are
  never checked — reads carry no state-change risk, and item 4 of the
  correction explicitly requires GET to remain usable.
- **The check runs before any Identity user lookup or RBAC evaluation.**
  A rejected origin throws immediately inside the actor-resolution
  function itself, before `dataVaultService.createRecord`/`updateRecord`/
  `archiveRecord` — or even `users.findByEmail` — is ever reached. This is
  verified directly by a unit test asserting `users.findByEmail` is never
  called when the origin check fails (§15, "cannot reach Data Vault
  mutation logic").
- **Allowed origins are plain configuration, not domain logic.** No
  hostname is hard-coded anywhere in `src/`; `SVE_DATA_VAULT_
  TRUSTED_ORIGINS` is read once, at container construction, from the
  environment (`src/config/trustedOrigins.ts`). It is deliberately not
  routed through the `SecretsProvider` abstraction used for actual secrets
  (the MFA encryption key, the SVEGIP bridge secret) — an allowed origin
  is not sensitive information (it is visible in every browser request
  regardless), and treating it as a secret would add indirection with no
  security benefit.
- **No permissive CORS was added.** This PR adds no `Access-Control-
  Allow-Origin` response header or CORS middleware of any kind; the
  Origin/Referer check described here is a request-time authorization
  decision made by the server, not a browser-enforced CORS policy, and
  the two are not the same mechanism.

### Behind the future same-origin reverse proxy

Once `/api/v1/data-vault/*` is proxied through the same host as
`apps/svegip` (§11, still not performed by this PR), `SVE_DATA_VAULT_
TRUSTED_ORIGINS` must be set to that exact origin (e.g. `https://
portal.example.sve`) — the same value the browser will show as the page's
own origin when it makes these requests. A same-origin deployment does not
make this check redundant: same-origin means the browser *will* attach the
cookie automatically to a request from anywhere (per the `SameSite=Lax`
discussion above), so the explicit Origin/Referer check remains the
active defense against a hostile third-party page triggering a
state-changing request — `SameSite` stops helping once same-origin is
achieved, and this check is what keeps working.

## 11. Browser-local data migration / import strategy

**No automatic import was performed or is planned by this PR.** Existing
`localStorage['sveRecords']` content has uncertain provenance (test/
staging/stale data, mixed across whichever browsers happened to write it)
and must never be silently uploaded.

**Finding on production data:** this repository has no way to inspect an
actual deployed browser's `localStorage` (it is client-side, per-browser
state, never sent to any server today — confirmed by reading every network
call in the current `data-vault/index.html` before this PR: only
`/api/session` and `/api/logout` are called, never anything carrying
record content). Whether the current deployment holds only the hard-coded
`seed` five records or additional real ones entered by users cannot be
determined from the codebase alone, and this PR does not assume either
way — it is recorded here as an open question for whoever operates the
live deployment to check, not assumed to be empty.

**If a migration is later authorized:** the recommended design (not built
in this PR) is a small, separate, explicitly-invoked admin utility that
(1) accepts an exported JSON blob of a `sveRecords` array (the admin
manually exports it from their own browser's devtools — never an
automatic upload), (2) validates and sanitizes every field against the
same rules `POST /records` already enforces, (3) requires the operator to
assign a `legalEntityId` and `classification` per record or per batch,
since the old shape has neither, (4) runs as one explicit, audited action
(a new `data_vault.record.imported` audit action, distinguishable from
organic creation), (5) is idempotent per import batch, and (6) is
reversible by archiving (never hard-deleting) anything imported in error.
None of this exists yet.

## 12. Deployment / cutover prerequisites (proposal only — not performed)

1. Deploy `platform-services/data-vault` (and `platform-services/
   identity`, which it depends on) somewhere reachable from `apps/
   svegip`'s Netlify site — SVE's private server or a container, per
   `docs/architecture/deployment-portability.md`. **Not done in this PR**
   — no AWS resources provisioned, no Netlify config changed.
2. Configure `SVEGIP_SESSION_SECRET` on that deployment (Data Vault's
   `.env.example`) to the exact value already in SVEGIP's Netlify
   environment (§9).
3. Configure `SVE_DATA_VAULT_TRUSTED_ORIGINS` to the exact origin
   `apps/svegip` will be served from once proxied (§10) — never left
   unset in any environment that enables the SVEGIP bridge for
   state-changing routes.
4. Add a Netlify redirect/proxy rule so `/api/v1/data-vault/*` (and, if
   the bridge is to be used, all of `/api/v1/*`) forwards to the deployed
   Data Vault service — `apps/svegip/netlify.toml` is untouched by this
   PR; this is a follow-up change touching production routing, needing
   its own explicit review/approval.
5. Provision real Identity `users`/role assignments/entity-access grants
   for whichever real SVEGIP employees need Data Vault access (§9) —
   administrative data entry, not a code change.
6. Decide and execute (or explicitly decide against) the browser-data
   migration in §11 before treating the new API as the sole source of
   truth for anyone who was actively using the old localStorage-backed
   page.
7. Only after 1–6: consider flipping `data-vault/index.html`'s
   `DATA_VAULT_API_BASE` to point at the live proxied path (it already
   does — `/api/v1/data-vault` — so step 4 is what actually activates it)
   and monitor before removing any fallback.

## 13. Rollback considerations

- The frontend change is a single file (`apps/svegip/data-vault/index.html`)
  with a `git diff`-visible, self-contained change; reverting it restores
  the previous localStorage-based behaviour immediately (though it would
  also revive the CRITICAL finding — rollback is a last resort, not a
  routine option).
- The new tables (`data_vault_records`, `data_vault_record_versions`) are
  additive — `002_data-vault-foundation` alters nothing in
  `001_identity-foundation`, and no existing SVEGIP table
  (`netlify/database/migrations/001-004`) is touched at all.
- Because record creation/update never happens without a successful,
  authorized API call, there is no server-side data to "lose" by rolling
  the frontend back — the two stores (old localStorage, new Postgres)
  never share write paths, so rollback cannot corrupt either.
- The package split (§5) is a pure code-organization change with no data
  migration implication — moving files between `platform-services/
  identity` and `platform-services/data-vault` does not touch any table
  or row.

## 14. Remaining risks / open questions

- **List authorization is applied in application code, per row**, not
  pushed into the SQL `WHERE` clause via the caller's entity-access grants.
  Correct at this scale (verified by tests) but will not scale to a large
  record volume — a future iteration should translate
  `listActiveEntityAccessGrants`/permission ceiling into SQL predicates.
- **Cross-package source imports are a documented, intentional coupling,
  not a long-term architecture.** Data Vault depending on Identity's
  `.ts` files by relative path (rather than an installed/versioned
  package) means the two packages must always be checked out and
  installed together, and a change to an imported Identity file's public
  shape is not caught by a package-version boundary — only by both
  packages' own test suites. Acceptable for two services in one
  monorepo at this stage; revisit via an npm workspace if a third
  business-domain package needs the same Identity contracts, or if
  Identity and Data Vault ever need independent versioning/release
  cadences.
- **No key-rotation mechanism** for `SVEGIP_SESSION_SECRET` sharing beyond
  "the same env var value in two places" — acceptable for a transitional
  bridge that is meant to be deleted once SVEGIP migrates onto Identity
  (§9), not a permanent design.
- **`SVE_DATA_VAULT_TRUSTED_ORIGINS` is a single flat allowlist with exact
  string matching** (no wildcard/subdomain support). Sufficient for one
  known SVEGIP origin; revisit if Data Vault ever needs to trust multiple
  environments' origins simultaneously from one deployment.
- **The browser-data migration in §11 is a proposal only.** Until it is
  explicitly authorized and executed (or explicitly declined), any Data
  Vault content a real user may have accumulated in their browser's
  `localStorage` before this PR remains there, invisible to the new API,
  and is not carried forward automatically.
- **Provisioning is manual.** There is no bulk-import from SVEGIP's
  `employee_accounts` into Identity's `users`/role/entity-grant tables;
  until an administrator provisions someone, a validly-authenticated
  SVEGIP user gets a clear `IDENTITY_NOT_PROVISIONED` 403, not silent
  access.
- **The Insight Notes / Report Data Packs / Client Workspaces / Project
  Command Centre / Review Queue / Risk register screens remain exactly as
  prototype-only as they were before this PR** — no persistence was added
  to them. They are not part of the CRITICAL finding and building real
  backing for them is a distinct future scope decision.
- **Remaining browser storage, and why each is not authoritative business
  data:**
  - `localStorage.removeItem('svegip_session')` / `sessionStorage.clear()`
    in the sign-out handler — a defensive cleanup call on logout, not a
    write of any record; SVEGIP's actual session lives in an `HttpOnly`
    cookie this JavaScript cannot read or write in the first place, so
    this line is a no-op safety net, not a data store.
  - No other `localStorage`/`sessionStorage`/IndexedDB usage remains
    anywhere in `apps/svegip/data-vault/index.html`.
- All items already flagged as open in `docs/architecture/
  identity-foundation.md` ("Remaining risks") — RBAC not yet gated on
  every non-Data-Vault route, in-process MFA challenge storage, no CORS
  config, TLS assumed upstream, no scheduled session-expiry sweep — remain
  open and are unchanged by this PR.

## 15. Tests

**Data Vault package** (`platform-services/data-vault/`):
- `test/unit/dataVault.test.ts` (17 tests, in-memory, using both
  Identity's own in-memory store for RBAC/organisation/audit and Data
  Vault's own for records — §5) — the authorization/entity/classification
  scenarios in §7 and audit-content redaction.
- `test/unit/dataVaultActor.test.ts` (8 tests) — the CSRF/origin gate in
  isolation: trusted-origin cookie POST passes; missing-Origin cookie
  POST on an unsafe method is rejected; hostile-Origin cookie POST is
  rejected (plus a Referer-fallback variant); GET remains usable under
  cookie auth with no Origin/Referer at all; native bearer-token calls
  are never subject to the check even with a hostile/missing Origin; a
  rejected check never reaches `users.findByEmail`; and CSRF passing is
  not itself authorization (an unprovisioned SVEGIP-authenticated caller
  with a trusted origin is still denied).
- `test/integration/postgres.test.ts` (6 real-Postgres tests) —
  server-generated unique record codes, the `classification`/
  `legal_entity_id` CHECK/FK constraints enforced at the database level,
  version-snapshot-on-update, archive-never-deletes, a SQL-injection-style
  input handled safely by parameterized queries, and a full
  entity-isolation/audit-trail run through `dataVaultService` against
  real tables.
- `test/integration/http.test.ts` (14 real-HTTP tests) — unauthenticated/
  invalid/revoked-session denial, the SVEGIP bridge's provisioning check
  (denied and authenticated, over real HTTP), three dedicated CSRF/origin
  end-to-end tests (trusted-origin cookie POST succeeds when RBAC
  permits; missing-origin cookie POST is rejected and never creates a
  record; hostile-origin cookie POST is rejected), a native-bearer POST
  with no Origin header succeeding, a full create→read→update→archive
  flow via bearer session, mass-assignment rejection, malformed-input
  rejection, the IDOR/existence-leak check, and the reference
  legal-entities endpoint.

**Identity package** (`platform-services/identity/`): unchanged from
before this correction except that all Data-Vault-specific tests and
wiring have been removed — `test/unit/svegipSessionBridge.test.ts` (10
tests) remains, since cookie verification itself is an Identity contract.
Identity's own full suite (96 tests as of this correction) is unaffected
by the Data Vault split; it neither imports nor tests anything
Data-Vault-specific.

Both packages' full suites pass against a real Postgres database, and
both were run through a clean-install CI simulation (fresh database,
`rm -rf node_modules && npm ci` in both `platform-services/identity` and
`platform-services/data-vault`, typecheck, migrate, test) before this
correction was pushed.
