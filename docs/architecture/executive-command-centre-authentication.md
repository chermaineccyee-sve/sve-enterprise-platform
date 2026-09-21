# Executive Command Centre Authentication — Two Layers

**Status: Layer 1 implemented (`apps/executive-vault` v5). Layer 2 is architecture-only — not implemented, and no Microsoft account has been contacted.**

This document exists because "authentication" for `apps/executive-vault` is two genuinely separate things, and the design deliberately keeps them apart rather than merging them into one login flow:

| | Layer 1 — Executive Command Centre Login | Layer 2 — Microsoft Account Connection |
|---|---|---|
| Answers | "Am I the authorised user of my own Command Centre?" | "Does the Command Centre have my consent to read my Outlook calendar?" |
| Who authenticates | Me, against this app's own credential | Me, against Microsoft's own sign-in/consent screen |
| Protocol | This app's own email + password, verified server-side | Microsoft identity platform OAuth 2.0 (MSAL, Authorization Code Flow) |
| Where a password is typed | This app's login screen only | Microsoft's own hosted sign-in page — never this app |
| Status | **Implemented** (this document) | **Not implemented** — see `docs/architecture/outlook-calendar-readiness-review.md` §2/§12 |
| Trigger | Opening the app | An explicit "Connect Outlook" action, taken only after Layer 1 is already satisfied |

No credential ever crosses between the two. Layer 1's database never stores anything Microsoft-related; Layer 2, when it is eventually built, will never touch `command_centre_users` or this app's own password. This document covers **Layer 1 only**.

## 1. Why not a shared application password

A single hard-coded "app password" (one secret, checked by equality, shared by definition even if only one person currently knows it) was explicitly rejected. Instead, Layer 1 is a real, if minimal, identity-bound login: a named account record (`command_centre_users`, keyed by email) with its own PBKDF2-hashed password, verified per request against that specific account — not an anonymous shared secret. The practical difference: the account can be renamed, deactivated (`status != 'Active'` immediately rejects it, no cookie edit or redeploy needed), or — if this ever needs to evolve — joined by a second row, none of which a bare shared password supports without a redesign.

**The one place a shared secret does appear** is `EXECUTIVE_VAULT_BOOTSTRAP_SECRET` — and it is explicitly *not* the login credential. It gates a single one-time provisioning call (`POST /api/bootstrap-user`) that creates the one account, using a password the account holder chooses at that moment. The endpoint refuses to run a second time once one account row exists, and the bootstrap secret should be removed from the environment immediately afterward. This matches the exact pattern `apps/svegip/netlify/functions/bootstrap-admin.mts` already uses in this repository for the same reason.

## 2. Single-user today, capable of evolving

`command_centre_users` is a proper table keyed by `email`, not a single-value config. Today it holds exactly one row (Ching Yee), and `bootstrap-user.mts` actively enforces that — `SELECT COUNT(*)` and refuse if `> 0`. This is a deliberate, easily-reversible choice: removing that one check (and replacing the bootstrap flow with a proper invite mechanism) is a small, later change, not a schema rewrite or a redesign of `login.mts`/`session.mts`, both of which already look up "the account matching this email," never "the one account."

## 3. What was built

Following the exact shape `apps/svegip`'s own Netlify Functions already establish in this repository (verified in the readiness review, `docs/architecture/outlook-calendar-readiness-review.md` §1) — Netlify Functions + Postgres via `@netlify/database` + an HMAC-signed session cookie — reused as a *pattern*, not shared code, since `apps/executive-vault` stays independent of `apps/svegip`.

**Database** (`netlify/database/migrations/001_command-centre-users/migration.sql`):
```sql
CREATE TABLE command_centre_users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 210000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
No role/unit/permissions columns — unlike `apps/svegip`'s `employee_accounts`, this app has no RBAC concept; it is simpler by design, not by oversight.

**Functions** (`netlify/functions/`):
- `_auth-core.mts` — shared crypto used by all four endpoints below: PBKDF2-SHA256 password hashing/verification (`hashPassword`/`verifyPasswordHash`) and HMAC-SHA256 session cookie signing/verification (`signSessionCookie`/`verifySessionCookie`/`sessionSetCookieHeader`/`sessionClearCookieHeader`). A future endpoint that needs to require a signed-in request (e.g. once Layer 2 adds one) would call `verifySessionCookie` the same way `session.mts` already does, then re-check the account is `Active`, rather than trusting the cookie's embedded state alone.
- `login.mts` (`POST /api/login`) — verifies email + password against `command_centre_users`, issues the signed `execvault_session` cookie (`HttpOnly; Secure; SameSite=Lax`, 8-hour expiry).
- `session.mts` (`GET /api/session`) — verifies the cookie and **re-checks the account is still `Active`** on every call (not just once at login), returning `{authenticated, user}`.
- `logout.mts` (`POST /api/logout`) — clears the cookie.
- `bootstrap-user.mts` (`POST /api/bootstrap-user`) — one-time account creation, guarded and self-disabling as described in §1.

**Frontend** (`apps/executive-vault/app.js`):
- `AUTH` state object (`authenticated`, `user`, `error`), `renderLoginScreen()`, `submitLogin(email, password)`, `signOut()`, `initApp()`.
- `render()` (the app's existing single dispatcher) now gates on `AUTH.authenticated` first — an unauthenticated render, from any cause including a hashchange firing while signed out, shows the login screen, never the app shell or any mock data.
- The topbar avatar is now the signed-in user's initials, opening a small menu ("Signed in as Ching Yee" + Sign Out) — reusing the existing notifications-popover interaction pattern rather than inventing a new one.
- The sidebar footer and Executive Home greeting now read the real signed-in name (falling back to `data.js`'s mock `USER_NAME` only in the test sandbox, which has no server to check against — see `test/loadApp.mjs`'s doc comment and `test/auth.test.mjs`).
- The login screen itself states "Personal Executive Command Centre — Ching Yee" — the production identification the UX explicitly needs — and asks only for this app's own email/password. It never mentions Microsoft or Outlook (enforced by an automated test).

## 4. Environment variables (names only)

See `apps/executive-vault/.env.example`. `EXECUTIVE_VAULT_SESSION_SECRET` (session cookie signing) and `EXECUTIVE_VAULT_BOOTSTRAP_SECRET` (one-time provisioning, removed after use) — no database URL to set by hand, per the Netlify DB convention `apps/svegip` already established.

## 5. What this deliberately does not do

- **No Microsoft credential of any kind** is collected, stored, or transmitted anywhere in Layer 1 — confirmed by an automated test asserting the login screen never mentions Microsoft/Outlook, and by `command_centre_users`' schema having no Microsoft-related column.
- **No token storage** — Layer 1 has nothing to do with the Graph access/refresh tokens Layer 2 will eventually need; those, when built, get their own encrypted-at-rest storage (see the readiness review §10), unrelated to `command_centre_users`.
- **Layer 2 is not started.** "Connect Outlook" remains the same clearly-labelled mock action it was before this phase — clicking it does not redirect to Microsoft, does not open a consent screen, and does not exist as working code yet.
