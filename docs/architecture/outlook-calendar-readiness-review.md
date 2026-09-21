# Microsoft Outlook Calendar (Read-Only) — Production Integration Readiness Review

**Status: review only. Nothing in this document has been implemented. No production code was modified to produce it. No Microsoft account has been contacted.** This supplements `executive-document-vault.md` §15.6 (the original architecture sketch) with an engineering readiness assessment: what the repository actually has today, what it is missing, and what order to do the missing work in.

---

## 1. Existing repository capabilities relevant to Microsoft integration

- **`apps/executive-vault/` has no backend of any kind today.** It is a static HTML/CSS/JS bundle (`index.html`, `app.js`, `data.js`, `styles.css`) with no build step, no `netlify.toml`, no `netlify/functions/` directory, and no backend dependency in `package.json` (only `node --test` for the frontend logic tests). Its own README states this explicitly: "No network call of any kind is made anywhere in this app." It is also not currently a deployed Netlify site — the root `README.md` lists only `apps/svegip` as "working, deployed." **This is the single biggest fact this whole review turns on**: there is nowhere in this app today that could safely hold a Microsoft client secret or a refresh token.
- **`apps/svegip` is the one app in the repo with a working production backend**, and it is the closest existing precedent for how this repo does server-side auth on Netlify:
  - `netlify.toml` (`publish = "."`, `functions = "netlify/functions"`, security headers).
  - `netlify/functions/*.mts` — Netlify Functions (Deno/Edge-style `.mts` handlers), e.g. `login.mts`, `session.mts`, `_auth-core.mts`, `vault-authorize.mts`.
  - Secrets read via `Netlify.env.get("SVEGIP_SESSION_SECRET")` etc. — never hard-coded, never in frontend JS.
  - A signed session cookie (`svegip_session`): JSON payload, base64url-encoded, HMAC-SHA256 signed with a server-only secret, `HttpOnly; Secure; SameSite=Lax`, verified via constant-shape logic in `_auth-core.mts`.
  - `@netlify/database` (Postgres via Netlify DB) as the persistence layer — no separate `DATABASE_URL` to configure by hand.
  - `.env.example` documents variable **names** only, verified against actual `Netlify.env.get()` calls, per `CONTRIBUTING.md`'s "Environment variables and secrets" convention.
  - This is a directly reusable **shape** for token custody — not existing Microsoft/OAuth code itself.
- **`platform-services/identity`** is a separate, more formal identity service (Postgres via `DatabaseProvider`, password + TOTP MFA + RBAC + session, provider-contract architecture). It is not deployed or wired to any running app yet, and it is designed for the platform's *own* primary login (credentials a user directly owns), not for holding a delegated third-party OAuth grant. Its `svegipSessionBridge.ts` is a useful **precedent** for one component in this repo trusting another's signed session cookie — but it is not itself an OAuth client, and wiring it to Microsoft would be a category mismatch: a Graph access/refresh token pair has its own lifecycle (expiry, refresh, Microsoft-side revocation) that isn't a "session" in Identity's sense.
- **`packages/security/AuthProvider.ts`** is a contract for the platform's *own* login (`verifyCredentials`/`completeLogin`/`resolveSession`), again not shaped for a delegated third-party grant. **`packages/security/SecretsProvider.ts`** is a portable secrets-abstraction contract — relevant to where a Microsoft client secret would ultimately be read from, once a real implementation exists (today `apps/svegip` reads secrets directly via `Netlify.env.get()`, not through this contract).
- **No Microsoft-related code exists anywhere in the repository.** A repository-wide search for MSAL, OAuth, Microsoft Graph, and Entra found zero packages, zero implementation code — only architecture-doc prose (this document's own predecessor, `executive-document-vault.md` §15.6) and unrelated coincidental matches (e.g. `apps/svegip`'s own session code, which is HMAC-based, not OAuth).
- **The current mock `MEETINGS` model** (`data.js`) already carries `clientId`, `matterId`, `workstreams[]` — the relationship shape §15.4 designed — but has **no timezone field at all** (`date`/`startTime`/`endTime` are naive local strings), no distinct organiser field, no online-meeting URL (only a free-text `location` string like `"Microsoft Teams"`), no `lastModified`, and no concept of an external event ID. This is fine for a fixed-timezone prototype; it is a real gap the moment live Graph data is introduced (§8 below).
- **"Prepare Meeting" is not an existing screen.** The closest current concept is the Meeting Brief (§15.3 of the architecture doc). Scoping a distinct "Prepare Meeting" screen vs. extending Meeting Brief is an open decision, not something already built (see §16).

## 2. Recommended authentication approach

Two genuinely separate concerns are easy to conflate — this review keeps them apart deliberately:

- **(a) Who is allowed to open the Command Centre app at all** (app-level auth). Today: nobody has to log in — it's a single-user static prototype with no login screen.
- **(b) How the app obtains delegated, read-only access to your M365/Outlook calendar** (the Microsoft OAuth grant).

Recommendation for (b): **MSAL, server-side, Authorization Code Flow (with PKCE), via `@azure/msal-node` in a new Netlify Function** — not MSAL.js in the browser, and not a client secret anywhere near frontend JavaScript. This is Microsoft's own recommended pattern for a confidential client with a backend, and it fits the repo's existing Netlify Functions precedent from `apps/svegip` directly: a new small `netlify/functions/` boundary in `apps/executive-vault` that plays the same role `_auth-core.mts`/`login.mts` play for SVEGIP, but for a Microsoft token instead of a password.

**Do not** wire `platform-services/identity` to Microsoft as a first step — it solves a different problem (this platform's own credential+MFA login) and pulling it in would either force a premature multi-tenant identity decision or produce a mismatched abstraction. **Do not** invent a second, unrelated identity system either. The right amount of new infrastructure is: one small, isolated server-side function boundary for `executive-vault`, following the `apps/svegip` shape, scoped only to what Outlook integration needs.

Recommendation for (a): because this is genuinely single-user today, app-level login can stay intentionally minimal — for example, gating purely on "has a linked Microsoft account" (i.e., Microsoft sign-in doubles as app access), or a lightweight signed-cookie gate mirroring `svegip_session`'s shape. This is a real design decision, not a default — see §16. What must **not** vary with "it's single-user" is Microsoft token custody itself: production-grade handling (server-side only, encrypted at rest, never in the browser) regardless of how simple the app-level login is.

## 3. Recommended Graph permission(s)

- **`Calendars.Read`** (delegated) — read-only, the minimum for everything in scope (Executive Home, My Day, This Week, Meeting Brief, Prepare Meeting, the Outlook Calendar connection screen). Matches §15.6's existing recommendation.
- **`offline_access`** — required to receive a refresh token for any session longer than ~1 hour. This is a standard, expected companion to any long-lived delegated Graph access, not scope creep.
- **`openid` / `profile` / `email`** — only if Microsoft sign-in is chosen to double as app-level login (§2/§16 open decision). Not required for calendar reading alone.
- **Explicitly not requested:** `Calendars.ReadWrite`, `Mail.Read` (or any Mail scope), `Contacts.Read` (Graph calendar events already embed organiser/attendee name and email inline — Contacts access is not technically required for anything listed in scope).

## 4. Proposed event-fetching architecture

- All Graph calls happen **server-side only**, inside a new Netlify Function (e.g. `netlify/functions/outlook-events.mts`) that holds the MSAL confidential client, performs token refresh, and calls `GET /me/calendarView?startDateTime=…&endDateTime=…` per §15.6.
- That Function returns to the frontend **only the shaped fields listed in the brief** (event ID, subject, start/end/timezone, organiser, attendees, location, online-meeting URL, categories, body preview, last-modified) — never the raw Graph response, and never the access token itself.
- `apps/executive-vault/app.js` calls this Function via `fetch("/api/outlook/events?...")`, the same way SVEGIP's frontend calls its own `/api/*` Functions today — same shape, new Functions, new app.
- Token storage: encrypted at rest, server-side only, in whatever small datastore backs `executive-vault`'s new Functions (§13) — never `localStorage`/`sessionStorage`/a JS-readable cookie.

## 5. Proposed local meeting-link mapping

Following the "Outlook owns calendar facts, Command Centre owns relationships" split the brief states and §15.4 already established for the mock model, the minimum new record is a **thin join**, not a copy of the Outlook event:

```
OutlookMeetingLink {
  outlookEventId      // Graph event.id — the join key back to Outlook
  calendarId          // supports more than one calendar later without a schema change
  clientId             // same optional/required shape as today's Meeting record (§15.4)
  engagementId
  matterId
  workstreams: []
  linkStatus           // "unlinked" | "linked" | "ignored"
  linkedAt
  linkedBy              // always "Me" today; kept for shape-stability, not multi-user need
  lastSyncedAt
}
```

Everything Outlook already owns (subject, start/end/timezone, organiser, attendees, location, `onlineMeeting.joinUrl`, categories, `bodyPreview`, `lastModifiedDateTime`) is fetched live and cached briefly (§7) — never duplicated into this record as a second source of truth. This is the same "never unnecessarily copy the authoritative source" principle §8 already applies to Google Drive metadata, applied consistently to Graph.

## 6. Unlinked Meetings workflow — validated

The existing §15.6 design is sound and this review does not change it, only confirms it against the current codebase (nothing contradicts it, since nothing is built yet):

```
Outlook Event synced
  → appears as an Unlinked Meeting (raw title/time only, mirrors the Executive Inbox pattern §13.8)
  → user explicitly links it to Client / Engagement / Matter / Workstream
    via the same progressive-disclosure panel the Meeting Brief already uses
  → Meeting Brief becomes context-aware (Client/Matter/Workstream rows appear)
```

**No automatic assignment from title/keyword matching, ever.** A keyword match may at most render as a dismissible *suggestion* chip ("Looks like VT Worldwide — link?") — the user's explicit confirmation remains the only thing that sets `clientId`/`matterId`. This should be enforced with an actual test (§15) asserting a title containing a client's name does not, by itself, set any relationship field.

## 7. Sync strategy for v1

**Recommended for v1:** fetch-on-open (when My Day/This Week/Executive Home is opened) with a short in-memory/server-side cache window (a few minutes) to avoid re-hitting Graph on every render, plus an explicit manual "Refresh" action on the Outlook Calendar connection screen.

**Deferred, deliberately:**
- **Delta queries** (`/me/events/delta`) — valuable once basic fetch-on-open is proven in real use, not before. Adds meaningful complexity (delta token storage/invalidation) for a v1 whose entire user base is one person opening the app themselves.
- **Webhook/change-notification subscriptions** — defer entirely. This would require a public, unauthenticated-until-validated webhook endpoint, subscription renewal management (Graph subscriptions expire and must be renewed), and notification-payload validation — a disproportionate amount of new attack surface and operational upkeep for a single-user, read-only v1.
- **No scheduled/background sync function in v1.** Purely request-driven, matching "don't over-engineer v1" and the fact nothing here needs to be always-on.

## 8. Timezone handling

**Real, currently-unaddressed gap:** the mock `MEETINGS` model has no timezone field — `date`/`startTime`/`endTime` are naive strings implicitly assumed to be in one fixed zone. Live Graph data returns `start.dateTime` + `start.timeZone` (commonly UTC or the organiser's zone, not necessarily the reader's), so this prototype convention cannot carry over unchanged.

**Recommended approach:**
- Convert every fetched event's start/end to an absolute instant (ISO 8601 UTC) **once, server-side**, at fetch time — never trust client-side parsing of an ambiguous local-looking string.
- Retain the event's original `timeZone` alongside the UTC instant, for display fidelity where it matters (e.g. showing "organiser's local time" is meaningful, not just yours).
- Render everything in the UI using a single formatting utility driven by an explicit IANA zone (`Asia/Kuala_Lumpur` / `Asia/Singapore` — both UTC+8, no DST, but still named explicitly rather than hard-coded as a fixed "+8" offset) via `Intl.DateTimeFormat`, so display stays correct while travelling if the working-timezone setting is ever changed, and so a UTC+8 offset assumption never silently breaks for an event Graph reports in another zone.
- Never do timezone math by string-slicing `startTime`/`endTime` the way the current mock data implicitly can get away with.

## 9. Error / connection states

| State | UX |
|---|---|
| **Not Connected** | Outlook Calendar screen shows a clear "Connect Microsoft Outlook" action; My Day/This Week fall back to demo data with a persistent "Demo Data" label (never silently blank, never silently indistinguishable from live data — see below). |
| **Connecting** | Brief in-progress state while the OAuth redirect/callback completes; no calendar content assumed until it returns. |
| **Connected** | Outlook Calendar screen shows the connected account (email only, not a token), last successful sync time. |
| **Refreshing** | A subtle inline indicator during a manual/automatic refresh — never blocks the UI or hides already-loaded events while refreshing. |
| **Expired / Reauthentication Required** | Refresh-token exchange fails (expired/revoked) → clear, specific prompt to reconnect; last-known events may still display, clearly marked stale, rather than vanishing. |
| **Permission Denied** | Graph returns 403 (e.g. consent revoked, conditional access policy) → explicit message naming that this is a Microsoft-side permission issue, not an app bug, with a reconnect path. |
| **Microsoft API Error** | Graph 5xx/timeout → generic "Outlook is temporarily unavailable" state, retry action, no raw error text/stack surfaced to the UI. |
| **Offline / Unable to Refresh** | Last successfully fetched events remain visible, marked with a "last updated" timestamp, rather than the screen going empty. |
| **No Events** | Explicit "Nothing on the calendar for this period" — distinct from any error state, so an empty calendar is never confused with a broken connection. |

**The existing demo calendar (`data.js`'s mock `MEETINGS`) must remain available and stay clearly, persistently labelled as demo data whenever it's the active source** — extending the app's own existing convention (README: mock actions already show an explanatory toast rather than pretending to be live) to a standing visual label, not just a one-time toast, since this data would now sit alongside genuinely live data for the first time.

## 10. Security model

- **Token storage:** Microsoft access + refresh tokens are encrypted at rest (AES-256-GCM), server-side only — reusing the exact primitive `platform-services/identity/src/crypto/mfaSecretCipher.ts` already implements for TOTP secrets in this repo, rather than inventing a new one. Key supplied via an environment variable, generated the same way as `SVE_IDENTITY_MFA_ENCRYPTION_KEY` (`openssl rand -base64 32`).
- **Browser storage risk:** Graph access/refresh tokens never reach the browser in any form — not in a cookie, not in `localStorage`/`sessionStorage`, not embedded in a page. Only a non-secret "connected/not connected + account email" status is ever sent to the frontend.
- **Refresh-token handling:** stored server-side, used by MSAL's own refresh logic to mint short-lived access tokens per Graph call — the app never hands out the refresh token itself to anything, including its own frontend.
- **Redirect URI security:** must be an exact-match HTTPS URI registered in Entra, pointing at a server-side callback Function — never a SPA-style fragment redirect that would expose an auth code/token to browser JS or to `window.location`-reading code.
- **Least-privilege Graph scopes:** `Calendars.Read` + `offline_access` only (§3) — no write scope requested by default, matching the same posture §8 already sets for Google Drive (`drive.readonly`/`drive.file`, never blanket `drive`).
- **Logout/disconnect behaviour:** "Disconnect" must delete the stored (encrypted) token server-side and revert the app to Not Connected immediately. It should also **say plainly** that this stops *this app's* access but does not itself force-revoke the grant on Microsoft's side — see next point.
- **Token revocation considerations:** deleting our stored refresh token stops our access effectively immediately (no valid token to refresh with). Fully revoking the grant at the source is a Microsoft-account-side action outside this app's control (via `myapps.microsoft.com` / Entra "Apps and services") — the UI should say this rather than imply a in-app "Disconnect" button reaches into Microsoft's systems.
- **Deployment secrets:** Client ID is not secret; Client Secret and the token-encryption key are, and follow the repo's existing convention exactly — named in a new `.env.example`, set via `Netlify.env.get()`/Netlify site environment variables, never committed, never bundled into frontend JS.
- **Logging concerns:** never log tokens, and never log full event bodies or full attendee lists server-side — log only event IDs and outcome/status codes, mirroring `_auth-core.mts`'s existing discipline (`console.error("...error", error)` without echoing secret material).
- **Accidental exposure of calendar content:** the Function-to-frontend contract returns only the explicitly shaped, minimum field set (§Target Integration) — never the full raw Graph response, which could carry materially more than intended (e.g. more body content than a "preview," internal Graph metadata).

## 11. Required environment variables (names only — no values)

| Variable | Purpose |
|---|---|
| `MICROSOFT_CLIENT_ID` | Entra app registration's Application (client) ID |
| `MICROSOFT_CLIENT_SECRET` | Confidential-client secret (server-side only) |
| `MICROSOFT_TENANT_ID` | Tenant ID, or `common`/`consumers` depending on the account-type decision (§16) |
| `MICROSOFT_REDIRECT_URI` | Exact-match HTTPS callback URI |
| `OUTLOOK_TOKEN_ENCRYPTION_KEY` | AES-256-GCM key for at-rest token encryption, generated like `SVE_IDENTITY_MFA_ENCRYPTION_KEY` |
| *(if a new app-level session is introduced)* `EXECUTIVE_VAULT_SESSION_SECRET` | HMAC signing secret for a lightweight app-access cookie, mirroring `SVEGIP_SESSION_SECRET`'s shape |

All would be documented (names + safe placeholders only) in a new `apps/executive-vault/.env.example`, per `CONTRIBUTING.md`.

## 12. Microsoft Entra configuration you will eventually need (not created now)

- **App registration** in Microsoft Entra ID.
- **Supported account type** — decide: single-tenant (your organisation's M365 only) vs. "personal Microsoft accounts" vs. both. This depends on whether your working calendar lives on a work/school M365 tenant or a personal Outlook.com account — **this needs your input before the app registration is created** (§16).
- **Redirect URI** — Web platform type, pointing to the server-side callback Function (e.g. `https://<your-site>/api/outlook/callback`), exact HTTPS match.
- **API permissions (delegated):** Microsoft Graph `Calendars.Read`, `offline_access`, and `openid`/`profile`/`email` only if Microsoft sign-in also gates app access (§2/§16).
- **Client secret** (or certificate) — needed because the recommended flow is a confidential client (Authorization Code Flow via a server-side Function), not a public/device-code client.
- **Admin consent** — not usually required for a single-user delegated read scope on your own tenant, but this depends on your tenant's own consent policy; if your organisation's Entra tenant restricts app consent, this could require an admin action outside this repository's control — flagged as a possible external blocker, not something this review can resolve.

## 13. Deployment changes required

- **`apps/executive-vault` needs to become an actually-deployed Netlify site first** — it isn't one today (only `apps/svegip` is deployed per the root README). This is infrastructure work that predates the Outlook integration itself.
- Add `apps/executive-vault/netlify.toml` (publish + functions directory), following `apps/svegip/netlify.toml`'s shape, including its security headers.
- Add `apps/executive-vault/netlify/functions/` with the new OAuth start/callback/token-refresh/event-fetch/disconnect Functions.
- Provision a small datastore for encrypted token storage — a new, dedicated store is recommended (consistent with the README's explicit "fully isolated" stance for this app: not bolted onto `apps/svegip`'s own database, and not `platform-services/identity`'s Postgres, which this app doesn't otherwise depend on). Netlify DB (the same `@netlify/database` mechanism SVEGIP already uses) is the natural first choice given the existing precedent, but this is a decision to make at implementation time, not now.
- Environment variables (§11) configured in Netlify's site settings — never in the repository, per `deployment-portability.md`'s environment conventions (`development`/`staging`/`production`).

## 14. Files/modules that would need modification (at implementation time — none touched by this review)

- **New:** `apps/executive-vault/netlify.toml`
- **New:** `apps/executive-vault/netlify/functions/outlook-auth-start.mts`, `outlook-auth-callback.mts`, `outlook-events.mts`, `outlook-disconnect.mts` (illustrative names)
- **New:** `apps/executive-vault/netlify/functions/_outlook-token-store.mts` — shared encrypt/decrypt/refresh helper, mirroring `_auth-core.mts`'s shared-module pattern
- **New:** `apps/executive-vault/.env.example`
- **Modified:** `apps/executive-vault/app.js` — the Outlook Calendar screen (replacing today's placeholder with real connect/status/refresh UI), My Day/This Week/Meeting Brief (merging live events with Unlinked Meetings), and a decision on Prepare Meeting as its own screen vs. an extension of Meeting Brief (§16 — not yet defined)
- **Modified:** `apps/executive-vault/data.js` — stays as the demo-data source, clearly separated from any live-data path (§9)
- **Modified:** `docs/architecture/executive-document-vault.md` §15.6 — updated from "architecture only" once actually implemented
- **New test infrastructure:** the current `test/loadApp.mjs` sandbox (Node `vm`, DOM-less) covers frontend logic but not Netlify Functions — Function-level tests need a different harness (e.g. calling exported handler logic directly with mocked `Request`/Graph responses); this is a tooling gap to solve during implementation, not something already in place.

## 15. Tests required

- **Unit:** timezone conversion (UTC ↔ display zone, across a range of Graph `timeZone` values, not just UTC-assumed input); `OutlookMeetingLink` CRUD; Unlinked → Linked transition logic.
- **A specific negative test:** a synced event whose title contains a known Client name must **not** result in any relationship field being auto-set — asserting the "explicit confirmation only" rule (§6) in code, not just in docs.
- **Integration:** token-refresh flow (mocked MSAL/Graph responses); each Graph error condition (401/403/5xx/timeout/network-offline) mapped to the correct UX state (§9); demo-vs-live data never silently conflated (a test asserting the "Demo Data" label is present whenever the mock `MEETINGS` source is active).
- **Security:** an automated check (unit test or CI grep, in the spirit of the audits referenced in `SVEGIP_ENTERPRISE_ASSESSMENT.md`) asserting no token/secret value ever appears in a Function's response payload to the frontend, and none in any committed file.
- **No live Microsoft account is touched by any test** — all Graph interaction mocked, consistent with this review never having connected to a real account either.

## 16. Risks / unresolved decisions

1. **Personal Microsoft account vs. work/school M365 tenant** — determines Entra's "supported account types" and whether admin consent is a possible blocker. Needs your input before an app registration is created.
2. **Where the token-storage datastore lives** — new dedicated store recommended (§13); not yet decided.
3. **"Prepare Meeting" is not a screen that exists today** — needs to be defined as either new or an extension of Meeting Brief before files/tests can be finalised.
4. **App-level login for `executive-vault`** — currently none exists at all. Introducing Microsoft sign-in may implicitly also answer "who can open this app," which is worth deciding on purpose rather than by accident (§2).
5. **`executive-vault` is not deployed on Netlify today** — standing it up is a real prerequisite step with its own small decision surface (site/domain, dev/staging/production separation per `deployment-portability.md`), and it precedes the Outlook work itself rather than being part of it.
6. **Full token revocation is outside this app's control** — a Microsoft-account-side action; the "Disconnect" UX must say so rather than overpromise.

---

## Recommendation

**PREREQUISITE WORK REQUIRED.**

The blocking gap is structural, not a Microsoft-integration detail: **`apps/executive-vault` has no server-side execution environment of any kind today** — no `netlify.toml`, no Functions, no datastore, no deployment. Every piece of this review (token custody, OAuth callback handling, encrypted storage, least-privilege scope enforcement) depends on that existing first. Building MSAL/Graph code against a purely static, client-only app would force an insecure shortcut (a token with nowhere safe to live) that this review is specifically designed to avoid.

**Recommended sequence**, before any Outlook code is written:

1. Decide personal vs. organisational Microsoft account context (§16.1) — this is yours to decide, not something to infer.
2. Stand up the minimal server-side boundary for `executive-vault` (`netlify.toml` + `netlify/functions/` + a token-storage datastore), following `apps/svegip`'s existing pattern — infrastructure work, deployable and testable with zero Microsoft involvement.
3. Decide `executive-vault`'s app-level login posture (§16.4) — currently none exists.
4. Define "Prepare Meeting" as a screen (§16.3).
5. Only then: you create the Entra app registration (§12) and implementation begins — Authorization Code Flow via MSAL server-side, `Calendars.Read` + `offline_access`, exactly as scoped in this report.

Nothing above requires contacting Microsoft or writing integration code yet — steps 1–4 are decisions and repository infrastructure only.
